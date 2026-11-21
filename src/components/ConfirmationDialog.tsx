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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Confirm Consequential Action
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                DOPE requires your explicit approval before executing this operation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm border-y border-slate-200 dark:border-slate-800 py-4">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Requested command</span>
            <span className="font-medium text-slate-900 dark:text-slate-100 text-right">
              {pending.rawInput}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Allowlisted action</span>
            <code className="font-mono text-xs text-blue-700 dark:text-blue-400">
              {action.action}
            </code>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Target platform</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{action.platform}</span>
          </div>
          {action.target && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Target</span>
              <span className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all text-right">
                {action.target}
              </span>
            </div>
          )}
          {action.parameters?.to && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Recipient</span>
              <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                {action.parameters.to}
              </span>
            </div>
          )}
          {action.parameters?.subject && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Subject</span>
              <span className="text-slate-800 dark:text-slate-200 text-right">
                {action.parameters.subject}
              </span>
            </div>
          )}
          {action.parameters?.body && (
            <div>
              <span className="block text-slate-500 dark:text-slate-400 mb-1">Message body</span>
              <p className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs">
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
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {busy ? 'Executing...' : 'Confirm & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
};
