import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Mail, Moon, Sun } from 'lucide-react';
import type { WorkspaceAccount } from '../lib/firebaseAuth';
import { AntigravityMark } from './AntigravityMark';

export type DopeTab = 'console' | 'commands' | 'devices' | 'platforms' | 'settings';

interface TopBarProps {
  activeTab: DopeTab;
  onSelectTab: (tab: DopeTab) => void;
  account: WorkspaceAccount | null;
  hasGmailToken: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSignIn: () => void;
  onConnectGmail: () => void;
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
  account,
  hasGmailToken,
  theme,
  onToggleTheme,
  onOpenSignIn,
  onConnectGmail,
  onGoogleSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const initials = (account?.displayName || account?.email || 'D')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/[0.08] bg-white/85 dark:bg-[#070708]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-8 gap-y-2">
        {/* Zone 1: Single-line Antigravity brand mark + DOPE wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('console')}
          className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#0A0A0C] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#2F71E3] rounded-lg cursor-pointer"
        >
          <AntigravityMark variant="color" className="w-6 h-6 shrink-0" />
          <span>DOPE</span>
        </button>

        {/* Zone 3: Single primary action / signed-in account popover */}
        <div className="shrink-0 order-2 md:order-3 relative" ref={menuRef}>
          {account ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Open account menu"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#141418] px-3 py-1.5 text-xs font-medium text-[#0A0A0C] dark:text-white hover:border-[#2F71E3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {account.photoURL ? (
                  <img
                    src={account.photoURL}
                    alt={account.displayName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-[#2F71E3] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {initials}
                  </span>
                )}
                <span className="max-w-[120px] truncate">{account.displayName}</span>
              </button>

              {menuOpen && (
                <div className="ag-animate-in absolute right-0 mt-2 w-64 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0D0D10] p-3 shadow-2xl z-50">
                  <div className="px-2 py-1.5 border-b border-black/10 dark:border-white/10">
                    <div className="text-sm font-semibold text-[#0A0A0C] dark:text-white truncate">
                      {account.displayName}
                    </div>
                    <div className="text-xs text-[#5F6368] dark:text-neutral-400 truncate">
                      {account.email}
                    </div>
                    <div className="text-[11px] text-[#2F75C3] dark:text-[#60A5FA] mt-1">
                      {account.provider === 'antigravity_workspace'
                        ? 'Antigravity Workspace Profile'
                        : hasGmailToken
                          ? 'Google Account · Gmail Connected'
                          : 'Google Account Connected'}
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {!hasGmailToken && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onConnectGmail();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-xl text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#2F71E3]" />
                        <span>Connect Gmail Permissions</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onToggleTheme();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-xl text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {theme === 'dark' ? (
                        <Sun className="w-3.5 h-3.5 text-[#FBBC05]" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-[#2F75C3]" />
                      )}
                      <span>
                        {theme === 'dark' ? 'Switch to Default Light' : 'Switch to Default Dark'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onGoogleSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
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
              <span>Sign in with Google</span>
            </button>
          )}
        </div>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="order-3 md:order-2 w-full md:w-auto flex items-center justify-between md:justify-center gap-3 sm:gap-7 pt-1 md:pt-0 border-t md:border-t-0 border-black/10 dark:border-white/[0.08]"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2F71E3] ${
                  active
                    ? 'border-[#2F75C3] dark:border-[#2F71E3] text-[#0A0A0C] dark:text-white'
                    : 'border-transparent text-[#5F6368] dark:text-neutral-400 hover:text-[#0A0A0C] dark:hover:text-white'
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
