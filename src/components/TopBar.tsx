import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Laptop, LogOut, Mail, Moon, Search, Settings, Sun, X } from 'lucide-react';
import type { WorkspaceAccount } from '../lib/firebaseAuth';
import type { CustomAlias } from '../shared/actions';
import {
  searchEcosystem,
  type EcosystemSearchResult,
  type SearchableDevice,
} from '../shared/ecosystemSearch';
import { AntigravityMark } from './AntigravityMark';

export type DopeTab = 'console' | 'commands' | 'devices' | 'platforms' | 'settings';

interface TopBarProps {
  activeTab: DopeTab;
  onSelectTab: (tab: DopeTab) => void;
  account: WorkspaceAccount | null;
  hasGmailToken: boolean;
  apiOnline: boolean;
  theme: 'light' | 'dark';
  devices: SearchableDevice[];
  aliases: CustomAlias[];
  onNavigateSearchResult: (result: EcosystemSearchResult) => void;
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
  apiOnline,
  theme,
  devices,
  aliases,
  onNavigateSearchResult,
  onToggleTheme,
  onOpenSignIn,
  onConnectGmail,
  onGoogleSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const searchResults = useMemo(
    () => searchEcosystem(searchQuery, devices, aliases, 10),
    [searchQuery, devices, aliases]
  );

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen, searchOpen]);

  // Global Cmd/Ctrl+K shortcut for quick ecosystem search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

  const handleSelectResult = (result: EcosystemSearchResult) => {
    onNavigateSearchResult(result);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const initials = (account?.displayName || account?.email || 'E')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/[0.08] bg-white/85 dark:bg-[#070708]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 lg:py-0 lg:h-16 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-4 gap-y-2">
        {/* Zone 1: Single-line brand mark + El Dorado wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('console')}
          className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#0A0A0C] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#2F71E3] rounded-lg cursor-pointer"
        >
          <AntigravityMark variant="color" className="w-6 h-6 shrink-0" />
          <span>El Dorado</span>
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="order-4 lg:order-2 w-full lg:w-auto flex items-center justify-between lg:justify-center gap-3 sm:gap-5 pt-1 lg:pt-0 border-t lg:border-t-0 border-black/10 dark:border-white/[0.08]"
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

        {/* Global Search Bar across Commands, Devices & Settings */}
        <div ref={searchRef} className="order-3 lg:order-3 w-full lg:w-60 xl:w-72 relative">
          <label htmlFor="global-ecosystem-search" className="sr-only">
            Search devices, commands, or settings
          </label>
          <div className="relative flex items-center">
            <Search
              aria-hidden="true"
              className="w-3.5 h-3.5 text-[#5F6368] dark:text-neutral-400 absolute left-3 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              id="global-ecosystem-search"
              type="search"
              aria-label="Search devices, commands, or settings"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search commands, devices, settings..."
              className="w-full rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#141418] pl-8 pr-8 py-1.5 text-xs text-[#0A0A0C] dark:text-white placeholder:text-[#5F6368] dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#2F71E3]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear global search"
                className="absolute right-2 p-0.5 rounded-full text-[#5F6368] dark:text-neutral-400 hover:text-[#0A0A0C] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {searchOpen && searchQuery.trim().length > 0 && (
            <div
              role="listbox"
              aria-label="Global search results"
              className="ag-animate-in absolute left-0 right-0 lg:right-0 lg:left-auto lg:w-96 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#0D0D10] p-2 shadow-2xl z-50"
            >
              {searchResults.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[#5F6368] dark:text-neutral-400">
                  No matching commands, devices, or settings.
                </div>
              ) : (
                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      role="option"
                      onClick={() => handleSelectResult(res)}
                      className="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <span className="mt-0.5 p-1.5 rounded-lg bg-[#F7F8FA] dark:bg-[#141418] text-[#2F75C3] dark:text-[#60A5FA] shrink-0">
                        {res.kind === 'device' ? (
                          <Laptop className="w-3.5 h-3.5" />
                        ) : res.kind === 'setting' ? (
                          <Settings className="w-3.5 h-3.5" />
                        ) : (
                          <Command className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-[#0A0A0C] dark:text-white truncate">
                          {res.title}
                        </span>
                        <span className="block text-[11px] text-[#5F6368] dark:text-neutral-400 truncate">
                          {res.subtitle}
                        </span>
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-[#5F6368] dark:text-neutral-300 shrink-0">
                        {res.kind}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 3: Global Health Status Indicator + Single primary action / signed-in account popover */}
        <div className="shrink-0 order-2 lg:order-4 flex items-center gap-2 relative" ref={menuRef}>
          <div
            role="status"
            aria-live="polite"
            data-testid="global-health-indicator"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
              apiOnline
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full shrink-0 ${
                apiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{apiOnline ? 'El Dorado System Online' : 'Disconnected'}</span>
          </div>

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
                <span className="max-w-[110px] truncate">{account.displayName}</span>
              </button>

              {menuOpen && (
                <div className="ag-animate-in absolute right-0 top-full mt-2 w-64 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0D0D10] p-3 shadow-2xl z-50">
                  <div className="px-2 py-1.5 border-b border-black/10 dark:border-white/10">
                    <div className="text-sm font-semibold text-[#0A0A0C] dark:text-white truncate">
                      {account.displayName}
                    </div>
                    <div className="text-xs text-[#5F6368] dark:text-neutral-400 truncate">
                      {account.email}
                    </div>
                    <div className="text-[11px] text-[#2F75C3] dark:text-[#60A5FA] mt-1">
                      {account.provider === 'antigravity_workspace'
                        ? 'El Dorado Workspace Profile'
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
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-full bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
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
      </div>
    </header>
  );
};
