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
        (cmd.hinglish_phrase ?? '').toLowerCase().includes(q) ||
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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Command Center &amp; Allowlisted Library
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Every voice command maps to a strictly validated action across all 10 categories.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Search commands"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phrases or actions..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Command Catalog Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Voice Phrase</th>
              <th className="py-3 px-4">Action &amp; Category</th>
              <th className="py-3 px-4">Supported Platforms</th>
              <th className="py-3 px-4">Permissions &amp; Safety</th>
              <th className="py-3 px-4">Status &amp; Failure Behavior</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                <td className="py-3.5 px-4 align-top">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {item.voice_phrase}
                  </div>
                  {item.hinglish_phrase && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Hinglish: {item.hinglish_phrase}
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-4 align-top">
                  <code className="font-mono text-xs text-blue-700 dark:text-blue-400">
                    {item.action}
                  </code>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.category}
                  </div>
                </td>
                <td className="py-3.5 px-4 align-top text-xs text-slate-700 dark:text-slate-300">
                  {item.supported_platforms.join(' · ')}
                </td>
                <td className="py-3.5 px-4 align-top text-xs text-slate-600 dark:text-slate-400">
                  <div>{item.required_permissions.join(', ')}</div>
                  <div className="mt-1 font-medium text-slate-800 dark:text-slate-200">
                    {item.requires_confirmation ? 'Requires confirmation' : 'No confirmation needed'}
                  </div>
                </td>
                <td className="py-3.5 px-4 align-top text-xs text-slate-600 dark:text-slate-400">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
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
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Custom Voice Aliases
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Map short personal phrases (for example, &ldquo;Hey Dop, morning briefing&rdquo;) to an
          allowlisted action.
        </p>

        <form onSubmit={handleAddAlias} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            aria-label="Custom alias phrase"
            value={aliasPhrase}
            onChange={(e) => setAliasPhrase(e.target.value)}
            placeholder="Voice phrase (e.g. coding mode)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
          <select
            aria-label="Alias allowlisted action"
            value={aliasAction}
            onChange={(e) => setAliasAction(e.target.value as ActionName)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
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
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={savingAlias}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{savingAlias ? 'Saving...' : 'Add Alias'}</span>
          </button>
        </form>

        {aliasError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{aliasError}</p>}

        <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
          {aliases.map((alias) => (
            <div key={alias.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  &ldquo;{alias.phrase}&rdquo;
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-3 font-mono">
                  {alias.action} {alias.target ? `· ${alias.target}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onDeleteAlias(alias.id)}
                aria-label={`Delete alias ${alias.phrase}`}
                className="p-1.5 rounded text-slate-500 hover:text-rose-600"
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
