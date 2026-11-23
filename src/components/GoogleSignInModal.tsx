import React, { useState } from 'react';
import { Check, Mail, ShieldCheck, X } from 'lucide-react';
import { AntigravityMark } from './AntigravityMark';

interface GoogleSignInModalProps {
  open: boolean;
  busy: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onGoogleLogin: (includeGmailScopes: boolean) => Promise<void>;
  onWorkspaceLogin: (name: string, email: string) => void;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  open,
  busy,
  errorMessage,
  onClose,
  onGoogleLogin,
  onWorkspaceLogin,
}) => {
  const [includeGmail, setIncludeGmail] = useState(false);
  const [name, setName] = useState('Doptails');
  const [email, setEmail] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  if (!open) return null;

  const handleWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    if (!name.trim()) {
      setFormErr('Please enter your display name.');
      return;
    }
    onWorkspaceLogin(name.trim(), email.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ag-signin-title"
    >
      <div className="ag-animate-in w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0D0D10] text-[#0A0A0C] dark:text-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7F8FA] dark:bg-[#141418] border border-black/10 dark:border-white/10 flex items-center justify-center">
              <AntigravityMark variant="color" className="w-6 h-6" />
            </div>
            <div>
              <h2 id="ag-signin-title" className="text-lg font-semibold tracking-tight">
                Sign in to DOPE
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-neutral-400">
                Sync your Antigravity voice workspace &amp; Google account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-1.5 rounded-lg text-[#5F6368] dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Primary Official Google Sign-In */}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGoogleLogin(includeGmail)}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full px-5 py-2.5 text-sm font-medium bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 transition-all disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{busy ? 'Opening Google Sign-In...' : 'Continue with Google'}</span>
          </button>

          <label className="flex items-start gap-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-[#F7F8FA] dark:bg-[#141418] p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeGmail}
              onChange={(e) => setIncludeGmail(e.target.checked)}
              className="mt-0.5 accent-[#2F71E3]"
            />
            <span className="text-xs text-[#5F6368] dark:text-neutral-300 leading-relaxed">
              <strong className="text-[#0A0A0C] dark:text-white inline-flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#2F71E3]" /> Also request Gmail Voice permissions
              </strong>{' '}
              (optional — leave unchecked for instant Google login without Gmail verification prompts).
            </span>
          </label>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
            >
              {errorMessage}
            </div>
          )}

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-black/10 dark:border-white/10" />
            <span className="px-3 text-[11px] font-medium text-[#5F6368] dark:text-neutral-400">
              or continue in Antigravity Workspace
            </span>
            <div className="flex-grow border-t border-black/10 dark:border-white/10" />
          </div>

          <form onSubmit={handleWorkspaceSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="ag-profile-name"
                className="block text-xs font-medium text-[#5F6368] dark:text-neutral-400 mb-1"
              >
                Workspace Name
              </label>
              <input
                id="ag-profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Doptails"
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#F7F8FA] dark:bg-[#141418] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F71E3]"
              />
            </div>

            <div>
              <label
                htmlFor="ag-profile-email"
                className="block text-xs font-medium text-[#5F6368] dark:text-neutral-400 mb-1"
              >
                Email (optional)
              </label>
              <input
                id="ag-profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@gmail.com"
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#F7F8FA] dark:bg-[#141418] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F71E3]"
              />
            </div>

            {formErr && <p className="text-xs text-rose-500">{formErr}</p>}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-black/15 dark:border-white/15 bg-transparent px-4 py-2 text-xs font-medium text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-[#2F71E3]" />
              <span>Enter Workspace as {name.trim() || 'Doptails'}</span>
            </button>
          </form>

          <p className="flex items-center gap-1.5 text-[11px] text-[#5F6368] dark:text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2F71E3] shrink-0" />
            OAuth access tokens remain strictly in memory and are cleared on sign out.
          </p>
        </div>
      </div>
    </div>
  );
};
