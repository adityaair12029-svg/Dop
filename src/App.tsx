import React, { useCallback, useEffect, useState } from 'react';
import type { ActionName, CustomAlias, DopeAction, DopePlatform } from './shared/actions';
import {
  continueWithAntigravityProfile,
  formatGoogleAuthError,
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
  type WorkspaceAccount,
} from './lib/firebaseAuth';
import { TopBar, type DopeTab } from './components/TopBar';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { GoogleSignInModal } from './components/GoogleSignInModal';
import { AntigravityLoginScreen } from './components/AntigravityLoginScreen';
import { InteractiveClickFlow } from './components/InteractiveClickFlow';
import { VoiceConsole, type GmailMessageItem, type HistoryRecord } from './components/VoiceConsole';
import { CommandLibrary } from './components/CommandLibrary';
import {
  DeviceManager,
  type DeviceRecord,
  type PendingPairingRecord,
} from './components/DeviceManager';
import { PlatformStudio } from './components/PlatformStudio';
import { ExtensionInstallModal } from './components/ExtensionInstallModal';
import { SettingsPanel, type AssistantSettingsState } from './components/SettingsPanel';
import {
  isJsonResponse,
  loadLocalState,
  localClearHistory,
  localCompletePairing,
  localConfirmDecision,
  localCreateAlias,
  localDeleteAlias,
  localInitPairing,
  localRevokeDevice,
  localToggleApproval,
  localUpdateSettings,
  runLocalCommandFallback,
  validateActionTarget,
} from './lib/vercelLocalEngine';

const DEFAULT_SETTINGS: AssistantSettingsState = {
  theme: 'dark',
  language: 'auto',
  wake_word_enabled: false,
  wake_word_engine: 'openwakeword',
  wake_word_sensitivity: 0.65,
  voice_feedback_enabled: true,
  store_history: true,
  remote_execution_requires_approval: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<DopeTab>('console');
  const [account, setAccount] = useState<WorkspaceAccount | null>(null);
  const [bypassGate] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1'
  );
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  const [settings, setSettings] = useState<AssistantSettingsState>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [aliases, setAliases] = useState<CustomAlias[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [pendingPairings, setPendingPairings] = useState<PendingPairingRecord[]>([]);
  const [healthInfo, setHealthInfo] = useState<{
    gemini_configured: boolean;
    connected_devices: number;
    catalog_count: number;
  } | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [installModalOpen, setInstallModalOpen] = useState<boolean>(false);

  const [gmailMessages, setGmailMessages] = useState<GmailMessageItem[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    entryId: string;
    rawInput: string;
    action: DopeAction;
    spokenResponse: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Sync Tailwind v4 dark class on <html>
  useEffect(() => {
    const isGate = !account && !bypassGate;
    document.documentElement.classList.toggle('dark', isGate ? true : settings.theme === 'dark');
  }, [settings.theme, account, bypassGate]);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [hRes, aRes, dRes, sRes, healthRes] = await Promise.all([
        fetch('/api/dope/history').catch(() => null),
        fetch('/api/dope/aliases').catch(() => null),
        fetch('/api/dope/devices').catch(() => null),
        fetch('/api/dope/settings').catch(() => null),
        fetch('/api/dope/health').catch(() => null),
      ]);

      if (hRes && isJsonResponse(hRes) && aRes && isJsonResponse(aRes) && sRes && isJsonResponse(sRes)) {
        const h = (await hRes.json()) as { history: HistoryRecord[] };
        const a = (await aRes.json()) as { aliases: CustomAlias[] };
        const s = (await sRes.json()) as { settings: AssistantSettingsState };
        setHistory(h.history);
        setAliases(a.aliases);
        setSettings(s.settings);
        if (dRes && isJsonResponse(dRes)) {
          const d = (await dRes.json()) as {
            devices: DeviceRecord[];
            pending_pairings: PendingPairingRecord[];
          };
          setDevices(d.devices);
          setPendingPairings(d.pending_pairings);
        }
        if (healthRes && isJsonResponse(healthRes)) {
          setHealthInfo(await healthRes.json());
          setApiOnline(true);
          return;
        }
        setApiOnline(false);
        return;
      }

      setApiOnline(Boolean(healthRes && isJsonResponse(healthRes)));
      const local = loadLocalState();
      setHistory(local.history);
      setAliases(local.aliases);
      setDevices(local.devices);
      setPendingPairings(local.pending_pairings);
      setSettings(local.settings);
      setHealthInfo({
        gemini_configured: false,
        connected_devices: local.devices.filter((d) => d.status === 'connected').length,
        catalog_count: 25,
      });
    } catch {
      setApiOnline(false);
      const local = loadLocalState();
      setHistory(local.history);
      setAliases(local.aliases);
      setDevices(local.devices);
      setPendingPairings(local.pending_pairings);
      setSettings(local.settings);
    }
  }, []);

  const checkApiHealth = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setApiOnline(false);
      return;
    }
    try {
      const res = await fetch('/api/dope/health', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      if (isJsonResponse(res)) {
        const data = (await res.json()) as {
          gemini_configured: boolean;
          connected_devices: number;
          catalog_count: number;
        };
        setHealthInfo(data);
        setApiOnline(true);
        return;
      }
      setApiOnline(false);
    } catch {
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
    void checkApiHealth();
    const interval = window.setInterval(() => {
      void checkApiHealth();
    }, 15000);
    const onOnline = () => void checkApiHealth();
    const onOffline = () => setApiOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsubscribe = initAuth(
      (acc, token) => {
        setAccount(acc);
        const resolvedToken = token ?? getAccessToken();
        setGmailToken(resolvedToken);
      },
      () => {
        setAccount(null);
        setGmailToken(null);
        setGmailMessages([]);
      }
    );
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubscribe();
    };
  }, [loadWorkspaceData, checkApiHealth]);

  const fetchGmailInbox = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken ?? gmailToken ?? getAccessToken();
      if (!token) return;
      setGmailLoading(true);
      setGmailError(null);
      try {
        const res = await fetch('/api/dope/gmail/messages', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { messages?: GmailMessageItem[]; error?: string };
        if (!res.ok) {
          setGmailError(data.error || 'Could not load Gmail messages.');
        } else {
          setGmailMessages(data.messages ?? []);
        }
      } catch (err: unknown) {
        setGmailError(err instanceof Error ? err.message : 'Network error reading Gmail.');
      } finally {
        setGmailLoading(false);
      }
    },
    [gmailToken]
  );

  const handleGoogleSignIn = async (includeGmailScopes: boolean) => {
    setIsSigningIn(true);
    setSignInError(null);
    setAuthBanner(null);
    try {
      const res = await googleSignIn({ includeGmailScopes });
      setAccount(res.account);
      setGmailToken(res.accessToken);
      setSignInModalOpen(false);
      if (res.accessToken) {
        await fetchGmailInbox(res.accessToken);
      }
    } catch (err: unknown) {
      const message = formatGoogleAuthError(err);
      setSignInError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleWorkspaceSignIn = (name: string, email: string) => {
    const profile = continueWithAntigravityProfile(name, email);
    setAccount(profile);
    setGmailToken(null);
    setSignInError(null);
    setAuthBanner(null);
    setSignInModalOpen(false);
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setAccount(null);
    setGmailToken(null);
    setGmailMessages([]);
  };

  const handleUpdateSettings = async (patch: Partial<AssistantSettingsState>) => {
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    localUpdateSettings(patch);
    try {
      const res = await fetch('/api/dope/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (isJsonResponse(res)) {
        const data = (await res.json()) as { settings: AssistantSettingsState };
        setSettings(data.settings);
      }
    } catch {
      // Local state already updated cleanly for static Vercel deployments
    }
  };

  const handleSubmitCommand = async (
    text: string,
    context: {
      platform: DopePlatform;
      pdf_viewer_type: 'browser_pdf_testbench' | 'unsupported_viewer';
      linux_display_server?: 'x11' | 'wayland';
    }
  ) => {
    const conversationHistory = history
      .slice(0, 4)
      .reverse()
      .flatMap((h) => [
        { role: 'user' as const, text: h.raw_input },
        { role: 'assistant' as const, text: h.spoken_response },
      ]);

    let data: Awaited<ReturnType<typeof runLocalCommandFallback>> | null = null;
    try {
      const res = await fetch('/api/dope/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          text,
          language: settings.language,
          context,
          conversationHistory,
        }),
      });
      if (isJsonResponse(res)) {
        data = await res.json();
        setApiOnline(true);
      }
    } catch {
      // Fall back smoothly when no Express backend is present or request times out
    }

    if (!data) {
      data = await runLocalCommandFallback({
        text,
        language: settings.language,
        context,
      });
    }

    await loadWorkspaceData();

    if (data?.status === 'awaiting_confirmation' && data?.action) {
      setPendingConfirmation({
        entryId: data.id,
        rawInput: text,
        action: data.action,
        spokenResponse: data.spoken_response,
      });
    }

    return data;
  };

  const handleConfirmDecision = async (decision: 'confirm' | 'cancel') => {
    if (!pendingConfirmation) return;
    setConfirmBusy(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = gmailToken ?? getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      let handledByServer = false;
      try {
        const res = await fetch('/api/dope/confirm', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entryId: pendingConfirmation.entryId,
            decision,
            action: pendingConfirmation.action,
          }),
        });
        if (isJsonResponse(res) || res.status === 400 || res.status === 401) {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            handledByServer = true;
            const data = (await res.json()) as { spoken_response?: string };
            if (data?.spoken_response && decision === 'confirm' && !res.ok) {
              setAuthBanner(data.spoken_response);
            }
          }
        }
      } catch {
        // Use local fallback
      }
      if (!handledByServer) {
        localConfirmDecision(pendingConfirmation.entryId, decision, pendingConfirmation.action);
      }
      setPendingConfirmation(null);
      await loadWorkspaceData();
    } finally {
      setConfirmBusy(false);
    }
  };

  // Fullscreen Login Gate before opening the main El Dorado website
  if (!account && !bypassGate) {
    return (
      <>
        <InteractiveClickFlow theme="dark" />
        <AntigravityLoginScreen
          busy={isSigningIn}
          errorMessage={signInError}
          onGoogleLogin={(includeGmail) => handleGoogleSignIn(includeGmail)}
          onWorkspaceLogin={handleWorkspaceSignIn}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#070708] text-[#0A0A0C] dark:text-white transition-colors duration-200 ag-workspace-liftoff">
      <InteractiveClickFlow theme={settings.theme} />

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        account={account}
        hasGmailToken={Boolean(gmailToken)}
        apiOnline={apiOnline}
        theme={settings.theme}
        onToggleTheme={() =>
          void handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
        }
        onOpenSignIn={() => {
          setSignInError(null);
          setSignInModalOpen(true);
        }}
        onConnectGmail={() => {
          setSignInError(null);
          setSignInModalOpen(true);
        }}
        onGoogleSignOut={() => void handleGoogleSignOut()}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {authBanner && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-4 ag-flow-enter"
          >
            <span>{authBanner}</span>
            <button
              type="button"
              onClick={() => setAuthBanner(null)}
              className="font-semibold underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div key={activeTab} className="ag-flow-enter">
          {activeTab === 'console' && (
            <VoiceConsole
              theme={settings.theme}
              onToggleTheme={() =>
                void handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              userName={account?.displayName ?? 'Explorer'}
              language={settings.language}
              onChangeLanguage={(lang) => void handleUpdateSettings({ language: lang })}
              voiceFeedbackEnabled={settings.voice_feedback_enabled}
              onToggleVoiceFeedback={() =>
                void handleUpdateSettings({
                  voice_feedback_enabled: !settings.voice_feedback_enabled,
                })
              }
              history={history}
              hasGmailToken={Boolean(gmailToken)}
              gmailMessages={gmailMessages}
              gmailLoading={gmailLoading}
              gmailError={gmailError}
              onFetchGmail={() => void fetchGmailInbox()}
              onRequestGoogleSignIn={() => {
                setSignInError(null);
                setSignInModalOpen(true);
              }}
              onSubmitCommand={handleSubmitCommand}
              onOpenExtensionStudio={() => setActiveTab('platforms')}
              onOpenInstallModal={() => setInstallModalOpen(true)}
            />
          )}

          {activeTab === 'commands' && (
            <CommandLibrary
              aliases={aliases}
              onCreateAlias={async (alias: { phrase: string; action: ActionName; target?: string }) => {
                const check = validateActionTarget(alias.action, alias.target);
                if (!check.valid) {
                  throw new Error(check.reason || 'Invalid action target for alias.');
                }
                try {
                  const res = await fetch('/api/dope/aliases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alias),
                  });
                  if (isJsonResponse(res)) {
                    await loadWorkspaceData();
                    return;
                  }
                  if (res.status === 400) {
                    const err = (await res.json().catch(() => ({}))) as { error?: string };
                    throw new Error(err.error || 'Failed to save custom alias.');
                  }
                } catch (e) {
                  if (e instanceof Error && /Invalid|Target|required/i.test(e.message)) throw e;
                }
                localCreateAlias(alias);
                await loadWorkspaceData();
              }}
              onDeleteAlias={async (id) => {
                localDeleteAlias(id);
                await fetch(`/api/dope/aliases/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
                await loadWorkspaceData();
              }}
            />
          )}

          {activeTab === 'devices' && (
            <DeviceManager
              devices={devices}
              pendingPairings={pendingPairings}
              onInitPairing={async (device_name, platform) => {
                try {
                  const res = await fetch('/api/dope/devices/pair/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_name, platform }),
                  });
                  if (isJsonResponse(res)) {
                    const data = (await res.json()) as { pairing: PendingPairingRecord };
                    await loadWorkspaceData();
                    return data.pairing;
                  }
                } catch {
                  // Fall back to local pairing code
                }
                const pairing = localInitPairing(device_name, platform);
                await loadWorkspaceData();
                return pairing;
              }}
              onCompletePairing={async (code) => {
                localCompletePairing(code);
                await fetch('/api/dope/devices/pair/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code }),
                }).catch(() => {});
                await loadWorkspaceData();
              }}
              onToggleApproval={async (id, approved) => {
                localToggleApproval(id, approved);
                await fetch(`/api/dope/devices/${encodeURIComponent(id)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ remote_control_approved: approved }),
                }).catch(() => {});
                await loadWorkspaceData();
              }}
              onRevokeDevice={async (id) => {
                localRevokeDevice(id);
                await fetch(`/api/dope/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
                await loadWorkspaceData();
              }}
            />
          )}

          {activeTab === 'platforms' && <PlatformStudio />}

          {activeTab === 'settings' && (
            <SettingsPanel
              settings={settings}
              healthInfo={healthInfo}
              hasGmailToken={Boolean(gmailToken)}
              onUpdateSettings={handleUpdateSettings}
              onClearHistory={async () => {
                localClearHistory();
                await fetch('/api/dope/history', { method: 'DELETE' }).catch(() => {});
                await loadWorkspaceData();
              }}
            />
          )}
        </div>
      </main>

      <GoogleSignInModal
        open={signInModalOpen}
        busy={isSigningIn}
        errorMessage={signInError}
        onClose={() => setSignInModalOpen(false)}
        onGoogleLogin={(includeGmail) => handleGoogleSignIn(includeGmail)}
        onWorkspaceLogin={handleWorkspaceSignIn}
      />

      <ConfirmationDialog
        pending={pendingConfirmation}
        busy={confirmBusy}
        onConfirm={() => void handleConfirmDecision('confirm')}
        onCancel={() => void handleConfirmDecision('cancel')}
      />

      <ExtensionInstallModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        onOpenPlatformStudio={() => setActiveTab('platforms')}
      />
    </div>
  );
}
