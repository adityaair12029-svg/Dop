import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  ACTION_CATALOG,
  validateDopeAction,
  type ActiveViewerContext,
  type DopeAction,
  type DopePlatform,
} from '../src/shared/actions';
import { interpretVoiceCommand, isGeminiConfigured } from './geminiService';
import {
  buildExtensionBundleZip,
  getActiveIconBuffer,
  saveCustomExtensionIcons,
} from './extensionZip';
import { buildDesktopBundleZip } from './desktopZip';
import {
  addCustomAlias,
  addHistoryEntry,
  clearHistory,
  completePairingSession,
  createPairingSession,
  deleteCustomAlias,
  deleteDevice,
  getStoreState,
  updateDevice,
  updateHistoryStatus,
  updateSettings,
} from './store';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 45;
const ipHits = new Map<string, number[]>();

function commandRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || 'local';
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Rate limit exceeded. Please wait a few seconds before sending more voice commands.',
    });
    return;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  next();
}

function resolveConfinedFile(baseDirName: 'docs' | 'platforms', relativePath: string): string | null {
  const rootDir = path.resolve(process.cwd(), baseDirName);
  const cleanRel = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(rootDir, cleanRel);
  if (!resolved.startsWith(rootDir + path.sep)) {
    return null;
  }
  return resolved;
}

function encodeMimeEmail(to: string, subject: string, body: string): string {
  const cleanTo = to.replace(/[\r\n]/g, '');
  const cleanSubject = subject.replace(/[\r\n]/g, '');
  const raw = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

export function registerRoutes(app: Express): void {
  // Allow installed Chrome/Edge extension origins to call public command/health endpoints
  app.use('/api/dope', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('chrome-extension://') || origin.startsWith('extension://'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  app.get('/api/dope/health', (_req, res) => {
    const state = getStoreState();
    res.json({
      ok: true,
      gemini_configured: isGeminiConfigured(),
      connected_devices: state.devices.filter((d) => d.status === 'connected').length,
      catalog_count: ACTION_CATALOG.length,
    });
  });

  app.get('/api/dope/catalog', (_req, res) => {
    res.json({ commands: ACTION_CATALOG });
  });

  app.post('/api/dope/command', commandRateLimit, async (req, res) => {
    const body = req.body as {
      text?: unknown;
      language?: unknown;
      context?: Partial<ActiveViewerContext>;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };

    if (typeof body?.text !== 'string' || !body.text.trim()) {
      res.status(400).json({ error: 'Command text is required.' });
      return;
    }

    const store = getStoreState();
    const safeContext: ActiveViewerContext = {
      platform: body.context?.platform ?? 'web',
      companion_connected: Boolean(
        store.devices.some(
          (d) =>
            d.status === 'connected' &&
            (d.platform === 'windows' || d.platform === 'macos' || d.platform === 'linux')
        ) || body.context?.companion_connected
      ),
      extension_connected: Boolean(
        store.devices.some(
          (d) => d.status === 'connected' && d.platform === 'browser_extension'
        ) || body.context?.extension_connected
      ),
      active_app: body.context?.active_app ?? 'DOPE Web Console',
      active_window_title: body.context?.active_window_title ?? 'DOPE PDF & Document Testbench',
      pdf_viewer_type: body.context?.pdf_viewer_type ?? 'browser_pdf_testbench',
      linux_display_server: body.context?.linux_display_server,
    };

    const result = await interpretVoiceCommand({
      text: body.text.trim().slice(0, 800),
      language: typeof body.language === 'string' ? body.language : store.settings.language,
      context: safeContext,
      aliases: store.aliases,
      conversationHistory: Array.isArray(body.conversationHistory) ? body.conversationHistory : [],
    });

    const status = !result.supported
      ? 'unsupported'
      : result.ambiguous
        ? 'clarification'
        : result.action.requires_confirmation
          ? 'awaiting_confirmation'
          : 'executed';

    const entryId = `cmd-${crypto.randomUUID().slice(0, 8)}`;
    addHistoryEntry({
      id: entryId,
      timestamp: new Date().toISOString(),
      raw_input: body.text.trim().slice(0, 800),
      wake_word_detected: result.wake_word_detected,
      language_hint: typeof body.language === 'string' ? body.language : store.settings.language,
      action: result.action,
      spoken_response: result.spoken_response,
      status,
      ai_source: result.ai_source,
      error_detail: result.error_detail,
    });

    res.json({
      id: entryId,
      status,
      ...result,
    });
  });

  app.post('/api/dope/confirm', async (req, res) => {
    const body = req.body as {
      entryId?: string;
      decision?: 'confirm' | 'cancel';
      action?: DopeAction;
    };

    if (body.decision === 'cancel') {
      if (body.entryId) {
        updateHistoryStatus(body.entryId, 'cancelled', 'Action cancelled by user.');
      }
      res.json({
        status: 'cancelled',
        spoken_response: 'Action cancelled. Nothing was changed.',
      });
      return;
    }

    if (!body.action) {
      res.status(400).json({ error: 'Action payload is required to confirm execution.' });
      return;
    }

    const store = getStoreState();
    const check = validateDopeAction(body.action, {
      platform: body.action.platform,
      companion_connected: store.devices.some(
        (d) =>
          d.status === 'connected' &&
          (d.platform === 'windows' || d.platform === 'macos' || d.platform === 'linux')
      ),
      extension_connected: store.devices.some(
        (d) => d.status === 'connected' && d.platform === 'browser_extension'
      ),
      active_app: 'DOPE Web Console',
      active_window_title: 'Confirmation Dialog',
    });

    if (!check.valid || !check.supported) {
      if (body.entryId) {
        updateHistoryStatus(body.entryId, 'unsupported', check.reason);
      }
      res.status(400).json({
        status: 'unsupported',
        spoken_response: check.reason ?? 'Cannot execute unsupported action.',
      });
      return;
    }

    // Real Gmail send when action is send_email
    if (check.action.action === 'send_email') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          status: 'error',
          spoken_response:
            'Please sign in with Google first so DOPE has permission to send emails through your Gmail account.',
        });
        return;
      }

      const to = check.action.parameters?.to;
      const subject = check.action.parameters?.subject || 'Message via DOPE Assistant';
      const emailBody = check.action.parameters?.body || '';
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        res.status(400).json({
          status: 'error',
          spoken_response: 'A valid recipient email address is required before sending.',
        });
        return;
      }

      try {
        const raw = encodeMimeEmail(to, subject, emailBody);
        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        });

        if (!gmailRes.ok) {
          const errData = (await gmailRes.json().catch(() => ({}))) as { error?: { message?: string } };
          const msg = errData.error?.message || `Gmail API returned HTTP ${gmailRes.status}`;
          if (body.entryId) {
            updateHistoryStatus(body.entryId, 'error', msg);
          }
          res.status(gmailRes.status).json({
            status: 'error',
            spoken_response: `Could not send email via Gmail: ${msg}`,
          });
          return;
        }

        const sent = (await gmailRes.json()) as { id?: string };
        const okMsg = `Email sent to ${to} via Gmail.`;
        if (body.entryId) {
          updateHistoryStatus(body.entryId, 'executed', okMsg);
        }
        res.json({
          status: 'executed',
          message_id: sent.id,
          spoken_response: okMsg,
        });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error calling Gmail API';
        res.status(502).json({
          status: 'error',
          spoken_response: `Failed to reach Gmail: ${msg}`,
        });
        return;
      }
    }

    const doneMsg = `Confirmed "${check.action.action}" on ${check.action.platform}.`;
    if (body.entryId) {
      updateHistoryStatus(body.entryId, 'executed', doneMsg);
    }
    res.json({
      status: 'executed',
      spoken_response: doneMsg,
    });
  });

  app.get('/api/dope/gmail/messages', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Sign in with Google to read Gmail messages.' });
      return;
    }

    try {
      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=6&q=in:inbox',
        { headers: { Authorization: authHeader } }
      );
      if (!listRes.ok) {
        const errData = (await listRes.json().catch(() => ({}))) as { error?: { message?: string } };
        res.status(listRes.status).json({
          error: errData.error?.message || `Gmail API error (${listRes.status})`,
        });
        return;
      }

      const listData = (await listRes.json()) as { messages?: Array<{ id: string }> };
      const ids = (listData.messages ?? []).slice(0, 6);
      const details = await Promise.all(
        ids.map(async ({ id }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: authHeader } }
          );
          if (!msgRes.ok) return null;
          const msg = (await msgRes.json()) as {
            id: string;
            snippet?: string;
            labelIds?: string[];
            payload?: { headers?: Array<{ name: string; value: string }> };
          };
          const headers = msg.payload?.headers ?? [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
          return {
            id: msg.id,
            subject: getHeader('Subject') || '(No Subject)',
            from: getHeader('From') || 'Unknown sender',
            date: getHeader('Date'),
            snippet: msg.snippet ?? '',
            unread: Boolean(msg.labelIds?.includes('UNREAD')),
          };
        })
      );

      res.json({ messages: details.filter(Boolean) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Gmail API.';
      res.status(502).json({ error: msg });
    }
  });

  app.get('/api/dope/history', (_req, res) => {
    res.json({ history: getStoreState().history });
  });

  app.delete('/api/dope/history', (_req, res) => {
    clearHistory();
    res.json({ ok: true });
  });

  app.get('/api/dope/aliases', (_req, res) => {
    res.json({ aliases: getStoreState().aliases });
  });

  app.post('/api/dope/aliases', (req, res) => {
    const body = req.body as {
      phrase?: string;
      action?: DopeAction['action'];
      target?: string;
      parameters?: DopeAction['parameters'];
    };
    if (!body.phrase?.trim() || !body.action) {
      res.status(400).json({ error: 'Phrase and action are required.' });
      return;
    }
    const validation = validateDopeAction(
      {
        action: body.action,
        target: body.target,
        platform: 'windows',
        requires_confirmation: false,
        parameters: body.parameters,
      },
      {
        platform: 'windows',
        companion_connected: true,
        extension_connected: true,
        active_app: 'Alias Builder',
        active_window_title: 'Alias Builder',
      }
    );
    if (!validation.valid) {
      res.status(400).json({ error: validation.reason ?? 'Invalid action for alias.' });
      return;
    }
    const alias = addCustomAlias({
      phrase: body.phrase.trim().slice(0, 80),
      action: validation.action.action,
      target: validation.action.target,
      parameters: validation.action.parameters,
    });
    res.status(201).json({ alias });
  });

  app.delete('/api/dope/aliases/:id', (req, res) => {
    const removed = deleteCustomAlias(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Alias not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/dope/devices', (_req, res) => {
    const state = getStoreState();
    res.json({ devices: state.devices, pending_pairings: state.pending_pairings });
  });

  app.post('/api/dope/devices/pair/init', (req, res) => {
    const body = req.body as { device_name?: string; platform?: DopePlatform };
    if (!body.device_name?.trim() || !body.platform) {
      res.status(400).json({ error: 'Device name and platform are required.' });
      return;
    }
    const pairing = createPairingSession(body.device_name, body.platform);
    res.status(201).json({ pairing });
  });

  app.post('/api/dope/devices/pair/complete', (req, res) => {
    const body = req.body as { code?: string; os_version?: string };
    if (!body.code?.trim()) {
      res.status(400).json({ error: 'Pairing code is required.' });
      return;
    }
    const result = completePairingSession(body.code, body.os_version);
    if (!result) {
      res.status(404).json({ error: 'Pairing code is invalid or expired.' });
      return;
    }
    res.status(201).json(result);
  });

  app.patch('/api/dope/devices/:id', (req, res) => {
    const body = req.body as {
      name?: string;
      status?: 'connected' | 'disconnected';
      remote_control_approved?: boolean;
    };
    const updated = updateDevice(req.params.id, body);
    if (!updated) {
      res.status(404).json({ error: 'Device not found.' });
      return;
    }
    res.json({ device: updated });
  });

  app.delete('/api/dope/devices/:id', (req, res) => {
    const deleted = deleteDevice(req.params.id);
    if (!deleted) {
      res.status(400).json({ error: 'Device not found or cannot revoke active browser session.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/dope/settings', (_req, res) => {
    res.json({ settings: getStoreState().settings });
  });

  app.put('/api/dope/settings', (req, res) => {
    const updated = updateSettings(req.body ?? {});
    res.json({ settings: updated });
  });

  // Safe read-only endpoint to serve the 14 docs + README & platform source files in the UI
  app.get('/api/dope/docs', (_req, res) => {
    const docsDir = path.resolve(process.cwd(), 'docs');
    const entries: Array<{ name: string; title: string; content: string }> = [];
    const rootReadme = path.resolve(process.cwd(), 'README.md');
    if (fs.existsSync(rootReadme)) {
      entries.push({
        name: 'README.md',
        title: 'README — DOPE Overview',
        content: fs.readFileSync(rootReadme, 'utf-8'),
      });
    }
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort();
      for (const file of files) {
        const full = resolveConfinedFile('docs', file);
        if (full && fs.existsSync(full)) {
          entries.push({
            name: file,
            title: file.replace(/\.md$/, '').replace(/_/g, ' '),
            content: fs.readFileSync(full, 'utf-8'),
          });
        }
      }
    }
    res.json({ docs: entries });
  });

  app.get('/api/dope/extension/icon.png', (_req, res) => {
    const buf = getActiveIconBuffer(128);
    if (!buf) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  });

  app.post('/api/dope/extension/logo', (req, res) => {
    const body = req.body as { icon16?: string; icon48?: string; icon128?: string };
    if (!body?.icon16 || !body?.icon48 || !body?.icon128) {
      res.status(400).json({ error: '16px, 48px, and 128px PNG icon data URLs are required.' });
      return;
    }
    const ok = saveCustomExtensionIcons({
      icon16: body.icon16,
      icon48: body.icon48,
      icon128: body.icon128,
    });
    if (!ok) {
      res.status(400).json({ error: 'Invalid PNG icon payload.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/dope/extension.zip', async (req, res) => {
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const origin = process.env.APP_URL?.startsWith('http')
      ? process.env.APP_URL
      : host
        ? `${proto}://${host}`
        : 'http://localhost:3000';
    const zip = await buildExtensionBundleZip(origin);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="DOPE-Chrome-Extension.zip"');
    res.send(zip);
  });

  app.get('/api/dope/desktop.zip', async (req, res) => {
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const origin = process.env.APP_URL?.startsWith('http')
      ? process.env.APP_URL
      : host
        ? `${proto}://${host}`
        : 'http://localhost:3000';
    const zip = await buildDesktopBundleZip(origin);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="DOPE-Desktop-Assistant.zip"');
    res.send(zip);
  });

  app.get('/api/dope/platform-files', (_req, res) => {
    const base = path.resolve(process.cwd(), 'platforms');
    const results: Array<{ platform: string; path: string; content: string }> = [];
    function walk(dir: string, relBase: string) {
      if (!fs.existsSync(dir)) return;
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        const rel = relBase ? `${relBase}/${item.name}` : item.name;
        if (item.isDirectory()) {
          walk(full, rel);
        } else if (!item.name.toLowerCase().endsWith('.png')) {
          const confined = resolveConfinedFile('platforms', rel);
          if (confined) {
            const top = rel.split('/')[0];
            results.push({
              platform: top,
              path: `platforms/${rel}`,
              content: fs.readFileSync(confined, 'utf-8'),
            });
          }
        }
      }
    }
    walk(base, '');
    res.json({ files: results });
  });
}
