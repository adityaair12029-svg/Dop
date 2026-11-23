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
import { VoiceConsole, type GmailMessageItem, type HistoryRecord } from './components/VoiceConsole';
import { CommandLibrary } from './components/CommandLibrary';
import {
  DeviceManager,
  type DeviceRecord,
  type PendingPairingRecord,
} from './components/DeviceManager';
import { PlatformStudio } from './components/PlatformStudio';
import { SettingsPanel, type AssistantSettingsState } from './components/SettingsPanel';

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
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [hRes, aRes, dRes, sRes, healthRes] = await Promise.all([
        fetch('/api/dope/history'),
        fetch('/api/dope/aliases'),
        fetch('/api/dope/devices'),
        fetch('/api/dope/settings'),
        fetch('/api/dope/health'),
      ]);
      if (hRes.ok) {
        const d = (await hRes.json()) as { history: HistoryRecord[] };
        setHistory(d.history);
      }
      if (aRes.ok) {
        const d = (await aRes.json()) as { aliases: CustomAlias[] };
        setAliases(d.aliases);
      }
      if (dRes.ok) {
        const d = (await dRes.json()) as {
          devices: DeviceRecord[];
          pending_pairings: PendingPairingRecord[];
        };
        setDevices(d.devices);
        setPendingPairings(d.pending_pairings);
      }
      if (sRes.ok) {
        const d = (await sRes.json()) as { settings: AssistantSettingsState };
        setSettings(d.settings);
      }
      if (healthRes.ok) {
        const d = await healthRes.json();
        setHealthInfo(d);
      }
    } catch {
      // Keep UI responsive on transient network errors
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
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
    return () => unsubscribe();
  }, [loadWorkspaceData]);

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
    const res = await fetch('/api/dope/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = (await res.json()) as { settings: AssistantSettingsState };
      setSettings(data.settings);
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

    const res = await fetch('/api/dope/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: settings.language,
        context,
        conversationHistory,
      }),
    });

    const data = await res.json();
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
      const res = await fetch('/api/dope/confirm', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryId: pendingConfirmation.entryId,
          decision,
          action: pendingConfirmation.action,
        }),
      });
      const data = (await res.json()) as { spoken_response?: string };
      if (data?.spoken_response && decision === 'confirm' && !res.ok) {
        setAuthBanner(data.spoken_response);
      }
      setPendingConfirmation(null);
      await loadWorkspaceData();
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#070708] text-[#0A0A0C] dark:text-white transition-colors duration-200">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        account={account}
        hasGmailToken={Boolean(gmailToken)}
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
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-4"
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

        {activeTab === 'console' && (
          <VoiceConsole
            theme={settings.theme}
            onToggleTheme={() =>
              void handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            userName={account?.displayName ?? 'Doptails'}
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
          />
        )}

        {activeTab === 'commands' && (
          <CommandLibrary
            aliases={aliases}
            onCreateAlias={async (alias: { phrase: string; action: ActionName; target?: string }) => {
              const res = await fetch('/api/dope/aliases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alias),
              });
              if (!res.ok) {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(err.error || 'Failed to save custom alias.');
              }
              await loadWorkspaceData();
            }}
            onDeleteAlias={async (id) => {
              await fetch(`/api/dope/aliases/${encodeURIComponent(id)}`, { method: 'DELETE' });
              await loadWorkspaceData();
            }}
          />
        )}

        {activeTab === 'devices' && (
          <DeviceManager
            devices={devices}
            pendingPairings={pendingPairings}
            onInitPairing={async (device_name, platform) => {
              const res = await fetch('/api/dope/devices/pair/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_name, platform }),
              });
              if (!res.ok) return null;
              const data = (await res.json()) as { pairing: PendingPairingRecord };
              await loadWorkspaceData();
              return data.pairing;
            }}
            onCompletePairing={async (code) => {
              await fetch('/api/dope/devices/pair/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
              });
              await loadWorkspaceData();
            }}
            onToggleApproval={async (id, approved) => {
              await fetch(`/api/dope/devices/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remote_control_approved: approved }),
              });
              await loadWorkspaceData();
            }}
            onRevokeDevice={async (id) => {
              await fetch(`/api/dope/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
              await fetch('/api/dope/history', { method: 'DELETE' });
              await loadWorkspaceData();
            }}
          />
        )}
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
    </div>
  );
}
