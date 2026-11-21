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

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GMAIL_SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// Access token is kept strictly in memory and never stored in localStorage/sessionStorage.
let cachedAccessToken: string | null = null;

export function initAuth(
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthSignedOut?: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthSignedOut) {
        onAuthSignedOut();
      }
    }
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string } | null> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in completed, but no Gmail access token was returned.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logoutGoogle(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}
