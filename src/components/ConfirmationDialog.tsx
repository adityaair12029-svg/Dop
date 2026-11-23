import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type { DopeAction } from '../shared/actions';

interface ConfirmationDialogProps {
  pending: {
    entryId: string;
    rawInput: string;
    action: DopeAction;
    spokenResponse: string;
  } | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  pending,
  busy,
  onConfirm,
  onCancel,
}) => {
  if (!pending) return null;

  const { action } = pending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="ag-animate-in w-full max-w-lg rounded-2xl bg-white dark:bg-[#0D0D10] border border-black/10 dark:border-white/10 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-lg font-semibold text-[#0A0A0C] dark:text-white"
              >
                Confirm Consequential Action
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-neutral-400 mt-0.5">
                El Dorado requires your explicit approval before executing this operation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="p-1.5 rounded-lg text-[#5F6368] dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm border-y border-black/10 dark:border-white/10 py-4">
          <div className="flex justify-between gap-4">
            <span className="text-[#5F6368] dark:text-neutral-400">Requested command</span>
            <span className="font-medium text-[#0A0A0C] dark:text-white text-right">
              {pending.rawInput}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#5F6368] dark:text-neutral-400">Allowlisted action</span>
            <code className="font-mono text-xs text-[#2F75C3] dark:text-[#60A5FA]">
              {action.action}
            </code>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#5F6368] dark:text-neutral-400">Target platform</span>
            <span className="font-medium text-[#0A0A0C] dark:text-white">{action.platform}</span>
          </div>
          {action.target && (
            <div className="flex justify-between gap-4">
              <span className="text-[#5F6368] dark:text-neutral-400">Target</span>
              <span className="font-mono text-xs text-[#0A0A0C] dark:text-neutral-200 break-all text-right">
                {action.target}
              </span>
            </div>
          )}
          {action.parameters?.to && (
            <div className="flex justify-between gap-4">
              <span className="text-[#5F6368] dark:text-neutral-400">Recipient</span>
              <span className="font-mono text-xs text-[#0A0A0C] dark:text-neutral-200">
                {action.parameters.to}
              </span>
            </div>
          )}
          {action.parameters?.subject && (
            <div className="flex justify-between gap-4">
              <span className="text-[#5F6368] dark:text-neutral-400">Subject</span>
              <span className="text-[#0A0A0C] dark:text-neutral-200 text-right">
                {action.parameters.subject}
              </span>
            </div>
          )}
          {action.parameters?.body && (
            <div>
              <span className="block text-[#5F6368] dark:text-neutral-400 mb-1">Message body</span>
              <p className="p-3 rounded-xl bg-[#F7F8FA] dark:bg-[#070708] border border-black/10 dark:border-white/10 text-[#0A0A0C] dark:text-neutral-200 text-xs">
                {action.parameters.body}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-full border border-black/15 dark:border-white/15 text-[#0A0A0C] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-medium rounded-full bg-[#2F75C3] dark:bg-[#2F71E3] text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Executing...' : 'Confirm & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
};
