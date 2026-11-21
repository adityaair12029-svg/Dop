import React from 'react';
import type { User } from 'firebase/auth';

export type DopeTab = 'console' | 'commands' | 'devices' | 'platforms' | 'settings';

interface TopBarProps {
  activeTab: DopeTab;
  onSelectTab: (tab: DopeTab) => void;
  user: User | null;
  hasGmailToken: boolean;
  isSigningIn: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: DopeTab; label: string }> = [
  { id: 'console', label: 'Console' },
  { id: 'commands', label: 'Commands' },
  { id: 'devices', label: 'Devices' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'settings', label: 'Settings' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  user,
  hasGmailToken,
  isSigningIn,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-8 gap-y-2">
        {/* Zone 1: Brand wordmark only */}
        <button
          type="button"
          onClick={() => onSelectTab('console')}
          className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
        >
          DOPE
        </button>

        {/* Zone 3 (ordered before nav on mobile via order-2 md:order-3 so brand + CTA share top row) */}
        <div className="shrink-0 order-2 md:order-3">
          {user && hasGmailToken ? (
            <button
              type="button"
              onClick={onGoogleSignOut}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              title={`Signed in as ${user.email ?? 'Google User'}`}
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              disabled={isSigningIn}
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
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
              <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav
          aria-label="Primary navigation"
          className="order-3 md:order-2 w-full md:w-auto flex items-center justify-between md:justify-center gap-3 sm:gap-6 pt-1 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  active
                    ? 'border-blue-600 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
