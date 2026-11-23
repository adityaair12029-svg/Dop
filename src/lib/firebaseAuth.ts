import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

export interface WorkspaceAccount {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  provider: 'google_firebase' | 'google_gis' | 'antigravity_workspace';
  hasGmailToken: boolean;
}

const LOCAL_PROFILE_STORAGE_KEY = 'dope_antigravity_workspace_profile_v1';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

let isSigningIn = false;
// Access token is kept strictly in memory and never stored in localStorage/sessionStorage.
let cachedAccessToken: string | null = null;
let cachedAccount: WorkspaceAccount | null = null;

function readSavedLocalProfile(): WorkspaceAccount | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceAccount>;
    if (!parsed.email || !parsed.displayName) return null;
    return {
      uid: parsed.uid || `ag-${parsed.email}`,
      displayName: parsed.displayName,
      email: parsed.email,
      photoURL: null,
      provider: 'antigravity_workspace',
      hasGmailToken: false,
    };
  } catch {
    return null;
  }
}

function saveLocalProfile(account: WorkspaceAccount | null): void {
  try {
    if (!account || account.provider !== 'antigravity_workspace') {
      sessionStorage.removeItem(LOCAL_PROFILE_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      LOCAL_PROFILE_STORAGE_KEY,
      JSON.stringify({
        uid: account.uid,
        displayName: account.displayName,
        email: account.email,
        provider: 'antigravity_workspace',
      })
    );
  } catch {
    // Ignore sessionStorage restrictions
  }
}

function fromFirebaseUser(user: User): WorkspaceAccount {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'DOPE User',
    email: user.email || '',
    photoURL: user.photoURL || null,
    provider: 'google_firebase',
    hasGmailToken: Boolean(cachedAccessToken),
  };
}

function createGoogleProvider(includeGmailScopes: boolean): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (includeGmailScopes) {
    for (const scope of GMAIL_SCOPES) {
      provider.addScope(scope);
    }
  }
  return provider;
}

export function formatGoogleAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');

  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the Google popup. Allow popups for this site or use Antigravity Workspace Sign-In below.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before finishing. Try again or continue with Antigravity Workspace Sign-In below.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This preview domain is not allowlisted for Firebase Google popup. Trying direct Google Identity / Antigravity Workspace sign-in instead.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google provider is disabled in Firebase Console. Use Antigravity Workspace Sign-In below or enable Google Auth.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network interrupted while reaching Google Auth. Check your connection or use Antigravity Workspace Sign-In below.';
  }
  return msg || 'Could not complete Google Sign-In.';
}

async function tryGisTokenSignIn(includeGmailScopes: boolean): Promise<{
  account: WorkspaceAccount;
  accessToken: string | null;
} | null> {
  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  const g = (
    window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (cfg: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string; error?: string }) => void;
              error_callback?: (err: { type?: string }) => void;
            }) => { requestAccessToken: () => void };
          };
        };
      };
    }
  ).google;

  if (!clientId || !g?.accounts?.oauth2?.initTokenClient) {
    return null;
  }

  const scopes = [
    'openid',
    'email',
    'profile',
    ...(includeGmailScopes ? GMAIL_SCOPES : []),
  ].join(' ');

  const token = await new Promise<string>((resolve, reject) => {
    try {
      const client = g.accounts!.oauth2!.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (resp) => {
          if (resp?.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error(resp?.error || 'Google OAuth consent was not completed.'));
          }
        },
        error_callback: (err) => {
          reject(new Error(err?.type || 'Google popup could not open.'));
        },
      });
      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });

  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!infoRes.ok) {
    throw new Error('Signed in with Google, but failed to read user profile.');
  }
  const info = (await infoRes.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  cachedAccessToken = includeGmailScopes ? token : null;
  const account: WorkspaceAccount = {
    uid: info.sub || `gis-${Date.now()}`,
    displayName: info.name || info.email?.split('@')[0] || 'Google User',
    email: info.email || '',
    photoURL: info.picture || null,
    provider: 'google_gis',
    hasGmailToken: includeGmailScopes && Boolean(token),
  };
  cachedAccount = account;
  return { account, accessToken: cachedAccessToken };
}

export function initAuth(
  onAuthSuccess?: (account: WorkspaceAccount, token: string | null) => void,
  onAuthSignedOut?: () => void
) {
  const savedLocal = readSavedLocalProfile();
  if (savedLocal) {
    cachedAccount = savedLocal;
    onAuthSuccess?.(savedLocal, null);
  }

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      const account = fromFirebaseUser(user);
      cachedAccount = account;
      saveLocalProfile(null);
      onAuthSuccess?.(account, cachedAccessToken);
    } else if (!isSigningIn) {
      const local = readSavedLocalProfile();
      if (local) {
        cachedAccount = local;
        onAuthSuccess?.(local, null);
        return;
      }
      cachedAccessToken = null;
      cachedAccount = null;
      onAuthSignedOut?.();
    }
  });
}

export async function googleSignIn(options?: {
  includeGmailScopes?: boolean;
}): Promise<{ account: WorkspaceAccount; accessToken: string | null }> {
  const includeGmail = Boolean(options?.includeGmailScopes);
  isSigningIn = true;
  try {
    try {
      const provider = createGoogleProvider(includeGmail);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (includeGmail && credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
      const account = fromFirebaseUser(result.user);
      cachedAccount = account;
      saveLocalProfile(null);
      return { account, accessToken: cachedAccessToken };
    } catch (firebaseErr: unknown) {
      const code =
        typeof firebaseErr === 'object' && firebaseErr !== null && 'code' in firebaseErr
          ? String((firebaseErr as { code?: unknown }).code ?? '')
          : '';

      // If restricted Gmail scopes or Firebase domain caused failure, try clean Google Identity Services fallback
      if (
        code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-allowed' ||
        code === 'auth/internal-error' ||
        includeGmail
      ) {
        const gisResult = await tryGisTokenSignIn(includeGmail).catch(() => null);
        if (gisResult) {
          return gisResult;
        }
        // Retry Firebase basic profile sign-in without restricted Gmail scopes if Gmail scopes were rejected
        if (includeGmail && code !== 'auth/popup-closed-by-user' && code !== 'auth/popup-blocked') {
          const basicProvider = createGoogleProvider(false);
          const basicResult = await signInWithPopup(auth, basicProvider);
          const account = fromFirebaseUser(basicResult.user);
          cachedAccount = account;
          return { account, accessToken: null };
        }
      }

      throw new Error(formatGoogleAuthError(firebaseErr));
    }
  } finally {
    isSigningIn = false;
  }
}

export function continueWithAntigravityProfile(name: string, email: string): WorkspaceAccount {
  const cleanName = name.trim() || 'Doptails';
  const cleanEmail = email.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '')}@workspace.local`;
  const account: WorkspaceAccount = {
    uid: `ag-${cleanEmail}`,
    displayName: cleanName,
    email: cleanEmail,
    photoURL: null,
    provider: 'antigravity_workspace',
    hasGmailToken: false,
  };
  cachedAccessToken = null;
  cachedAccount = account;
  saveLocalProfile(account);
  return account;
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCachedAccount(): WorkspaceAccount | null {
  return cachedAccount;
}

export async function logoutGoogle(): Promise<void> {
  cachedAccessToken = null;
  cachedAccount = null;
  saveLocalProfile(null);
  try {
    await auth.signOut();
  } catch {
    // Ignore sign-out errors if running on local workspace profile
  }
}
