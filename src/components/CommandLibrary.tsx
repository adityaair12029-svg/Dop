import React, { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  ACTION_CATALOG,
  ALLOWLISTED_ACTIONS,
  type ActionName,
  type CommandCategory,
  type CustomAlias,
} from '../shared/actions';

interface CommandLibraryProps {
  aliases: CustomAlias[];
  onCreateAlias: (alias: { phrase: string; action: ActionName; target?: string }) => Promise<void>;
  onDeleteAlias: (id: string) => Promise<void>;
}

const CATEGORIES: Array<'All' | CommandCategory> = [
  'All',
  'Applications',
  'Browser',
  'PDF and Documents',
  'Window Controls',
  'System Settings',
  'Navigation',
  'Media Controls',
  'File and Folder Operations',
  'Voice Conversation',
  'Device Management',
];

export const CommandLibrary: React.FC<CommandLibraryProps> = ({
  aliases,
  onCreateAlias,
  onDeleteAlias,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | CommandCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [aliasPhrase, setAliasPhrase] = useState('');
  const [aliasAction, setAliasAction] = useState<ActionName>('open_url');
  const [aliasTarget, setAliasTarget] = useState('https://www.youtube.com');
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [savingAlias, setSavingAlias] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ACTION_CATALOG.filter((cmd) => {
      if (selectedCategory !== 'All' && cmd.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        cmd.voice_phrase.toLowerCase().includes(q) ||
        cmd.action.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    setAliasError(null);
    if (!aliasPhrase.trim()) {
      setAliasError('Enter a custom voice phrase first.');
      return;
    }
    setSavingAlias(true);
    try {
      await onCreateAlias({
        phrase: aliasPhrase.trim(),
        action: aliasAction,
        target: aliasTarget.trim() || undefined,
      });
      setAliasPhrase('');
    } catch (err: unknown) {
      setAliasError(err instanceof Error ? err.message : 'Failed to create alias.');
    } finally {
      setSavingAlias(false);
    }
  };

  return (
    <div className="space-y-8 ag-animate-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/10 dark:border-white/[0.08] pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0C] dark:text-white">
            Command Center &amp; Allowlisted Library
          </h1>
          <p className="text-sm text-[#5F6368] dark:text-neutral-400 mt-0.5">
            Every voice command maps to a strictly validated action across all 10 categories.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#5F6368] dark:text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Search commands"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phrases or actions..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-full border border-black/10 dark:border-white/15 bg-[#F7F8FA] dark:bg-[#0D0D10] text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
          />
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#0A0A0C] text-white dark:bg-white dark:text-[#070708]'
                  : 'bg-[#F7F8FA] dark:bg-[#0D0D10] border border-black/10 dark:border-white/[0.08] text-[#5F6368] dark:text-neutral-300 hover:text-[#0A0A0C] dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Command Catalog Table */}
      <div className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/[0.08] text-xs font-semibold text-[#5F6368] dark:text-neutral-400">
              <th className="py-3.5 px-4">Voice Phrase</th>
              <th className="py-3.5 px-4">Action &amp; Category</th>
              <th className="py-3.5 px-4">Supported Platforms</th>
              <th className="py-3.5 px-4">Permissions &amp; Safety</th>
              <th className="py-3.5 px-4">Status &amp; Failure Behavior</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/[0.08]">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                <td className="py-3.5 px-4 align-top">
                  <div className="font-medium text-[#0A0A0C] dark:text-white">
                    {item.voice_phrase}
                  </div>
                </td>
                <td className="py-3.5 px-4 align-top">
                  <code className="font-mono text-xs text-[#2F75C3] dark:text-[#60A5FA]">
                    {item.action}
                  </code>
                  <div className="text-xs text-[#5F6368] dark:text-neutral-400 mt-0.5">
                    {item.category}
                  </div>
                </td>
                <td className="py-3.5 px-4 align-top text-xs text-[#5F6368] dark:text-neutral-300">
                  {item.supported_platforms.join(' · ')}
                </td>
                <td className="py-3.5 px-4 align-top text-xs text-[#5F6368] dark:text-neutral-400">
                  <div>{item.required_permissions.join(', ')}</div>
                  <div className="mt-1 font-medium text-[#0A0A0C] dark:text-neutral-200">
                    {item.requires_confirmation ? 'Requires confirmation' : 'No confirmation needed'}
                  </div>
                </td>
                <td className="py-3.5 px-4 align-top text-xs text-[#5F6368] dark:text-neutral-400">
                  <div className="font-medium text-[#0A0A0C] dark:text-white">
                    {item.implementation_status === 'implemented_web'
                      ? 'Active in Web & Companion'
                      : 'Active via Native Companion'}
                  </div>
                  <div className="mt-0.5">{item.failure_behavior}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom Voice Aliases */}
      <section className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-[#F7F8FA] dark:bg-[#0D0D10] p-6">
        <h2 className="text-lg font-semibold text-[#0A0A0C] dark:text-white">
          Custom Voice Aliases
        </h2>
        <p className="text-xs text-[#5F6368] dark:text-neutral-400 mt-1">
          Map short personal phrases (for example, &ldquo;Hey El Dorado, morning briefing&rdquo;) to an
          allowlisted action.
        </p>

        <form onSubmit={handleAddAlias} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            aria-label="Custom alias phrase"
            value={aliasPhrase}
            onChange={(e) => setAliasPhrase(e.target.value)}
            placeholder="Voice phrase (e.g. coding mode)"
            className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
          />
          <select
            aria-label="Alias allowlisted action"
            value={aliasAction}
            onChange={(e) => setAliasAction(e.target.value as ActionName)}
            className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
          >
            {Array.from(ALLOWLISTED_ACTIONS).map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
          <input
            type="text"
            aria-label="Alias target URL or app"
            value={aliasTarget}
            onChange={(e) => setAliasTarget(e.target.value)}
            placeholder="Target URL or app name"
            className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#070708] px-3.5 py-2 text-sm text-[#0A0A0C] dark:text-white focus:outline-none focus:border-[#2F71E3]"
          />
          <button
            type="submit"
            disabled={savingAlias}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{savingAlias ? 'Saving...' : 'Add Alias'}</span>
          </button>
        </form>

        {aliasError && <p className="mt-2 text-xs text-rose-500">{aliasError}</p>}

        <div className="mt-5 divide-y divide-black/10 dark:divide-white/[0.08]">
          {aliases.map((alias) => (
            <div key={alias.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-[#0A0A0C] dark:text-white">
                  &ldquo;{alias.phrase}&rdquo;
                </span>
                <span className="text-xs text-[#5F6368] dark:text-neutral-400 ml-3 font-mono">
                  {alias.action} {alias.target ? `· ${alias.target}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onDeleteAlias(alias.id)}
                aria-label={`Delete alias ${alias.phrase}`}
                className="p-1.5 rounded-lg text-[#5F6368] hover:text-rose-500 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
