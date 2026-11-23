import React, { useState } from 'react';
import { ArrowLeft, Check, Mail, ShieldCheck } from 'lucide-react';
import { AntigravityFlowWave } from './AntigravityFlowWave';
import { AntigravityMark } from './AntigravityMark';

interface AntigravityLoginScreenProps {
  busy: boolean;
  errorMessage: string | null;
  onGoogleLogin: (includeGmailScopes: boolean) => Promise<void>;
  onWorkspaceLogin: (name: string, email: string) => void;
}

/**
 * Full-viewport Welcome & Login Gate matching the exact visual hierarchy,
 * palette, glowing particle horizon, and pill buttons before entering
 * the El Dorado website workspace.
 */
export const AntigravityLoginScreen: React.FC<AntigravityLoginScreenProps> = ({
  busy,
  errorMessage,
  onGoogleLogin,
  onWorkspaceLogin,
}) => {
  const [mode, setMode] = useState<'main' | 'business'>('main');
  const [showTroublePanel, setShowTroublePanel] = useState(false);
  const [includeGmail, setIncludeGmail] = useState(false);
  const [name, setName] = useState('Explorer');
  const [email, setEmail] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const handleBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    if (!name.trim()) {
      setFormErr('Please enter your Workspace or Business name.');
      return;
    }
    onWorkspaceLogin(name.trim(), email.trim());
  };

  return (
    <div
      data-testid="antigravity-login-screen"
      className="relative min-h-screen w-full overflow-hidden bg-[#050507] text-white flex flex-col items-center justify-center px-4 pb-20"
    >
      {/* Flowing 3D Dotted Wave & Nebula Glow at Bottom */}
      <AntigravityFlowWave className="fixed inset-0 w-full h-full z-0" />

      {/* Centered Welcome Stack */}
      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center ag-flow-enter">
        <div className="ag-float mb-5 text-white">
          <AntigravityMark variant="monochrome" className="w-10 h-10" />
        </div>

        <h1 className="text-[28px] sm:text-[31px] font-normal tracking-[-0.025em] text-center text-white mb-7">
          Welcome to El Dorado!
        </h1>

        {/* Dark Rounded Card Container */}
        <div className="w-full rounded-[18px] bg-[#0B0C0F]/92 border border-white/[0.08] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-md">
          {mode === 'main' ? (
            <div className="space-y-2.5 ag-flow-enter">
              {/* Primary Royal Blue Pill CTA */}
              <button
                type="button"
                disabled={busy}
                onClick={() => void onGoogleLogin(includeGmail)}
                className="ag-pressable w-full h-11 rounded-full bg-[#3275F4] hover:bg-[#3F82FF] text-white text-[14px] font-medium flex items-center justify-center gap-2.5 shadow-[0_6px_24px_rgba(50,117,244,0.32)] disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v3.2h5.35c-.45 2.35-2.5 3.9-5.35 3.9a5.8 5.8 0 0 1 0-11.6c1.5 0 2.85.55 3.9 1.45l2.45-2.45A9.3 9.3 0 0 0 12 2.7a9.3 9.3 0 1 0 0 18.6c5.35 0 9.1-3.75 9.1-9.05 0-.4-.05-.8-.15-1.15Z"
                  />
                </svg>
                <span>{busy ? 'Opening Google Sign-In...' : 'Continue with Google'}</span>
              </button>

              {/* Secondary Dark Charcoal Pill */}
              <button
                type="button"
                onClick={() => setMode('business')}
                className="ag-pressable w-full h-11 rounded-full bg-[#1C1D22] hover:bg-[#25272E] text-[#E5E7EB] text-[14px] font-medium flex items-center justify-center border border-white/[0.05] cursor-pointer"
              >
                Use Business Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleBusinessSubmit} className="space-y-3 ag-flow-enter">
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => setMode('main')}
                  className="ag-pressable inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <span className="text-xs font-medium text-[#9CA3AF]">Business / Workspace Account</span>
              </div>

              <div>
                <label htmlFor="ag-gate-name" className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                  Display Name
                </label>
                <input
                  id="ag-gate-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Explorer"
                  className="w-full rounded-xl border border-white/10 bg-[#141519] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#3275F4]"
                />
              </div>

              <div>
                <label htmlFor="ag-gate-email" className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                  Work or Gmail Address (optional)
                </label>
                <input
                  id="ag-gate-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@gmail.com"
                  className="w-full rounded-xl border border-white/10 bg-[#141519] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#3275F4]"
                />
              </div>

              {formErr && <p className="text-xs text-rose-400">{formErr}</p>}

              <button
                type="submit"
                className="ag-pressable w-full h-11 rounded-full bg-[#3275F4] hover:bg-[#3F82FF] text-white text-[14px] font-medium flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(50,117,244,0.32)] cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Open El Dorado Website</span>
              </button>
            </form>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed ag-flow-enter"
            >
              <div>{errorMessage}</div>
              <button
                type="button"
                onClick={() => onWorkspaceLogin('Explorer', '')}
                className="ag-pressable mt-2 inline-flex items-center gap-1.5 rounded-full bg-white text-[#070708] px-3 py-1 text-[11px] font-semibold cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Continue directly as Explorer</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Help Link matching Screenshot */}
        <button
          type="button"
          onClick={() => setShowTroublePanel((v) => !v)}
          className="ag-pressable mt-4 text-[12px] text-[#7D828C] hover:text-white transition-colors cursor-pointer"
        >
          Having trouble signing in?
        </button>

        {showTroublePanel && (
          <div className="mt-3 w-full rounded-2xl border border-white/[0.08] bg-[#0B0C0F]/95 p-3.5 text-xs text-[#9CA3AF] space-y-2.5 backdrop-blur-md ag-flow-enter">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGmail}
                onChange={(e) => setIncludeGmail(e.target.checked)}
                className="mt-0.5 accent-[#3275F4]"
              />
              <span className="leading-relaxed">
                <strong className="text-white inline-flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#3275F4]" /> Also request Gmail Voice permissions
                </strong>{' '}
                (leave unchecked if Google shows a verification warning).
              </span>
            </label>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3275F4]" /> Tokens stay in memory only
              </span>
              <button
                type="button"
                onClick={() => onWorkspaceLogin('Explorer', '')}
                className="ag-pressable rounded-full bg-[#1C1D22] hover:bg-[#25272E] border border-white/10 px-3 py-1 text-[11px] font-medium text-white cursor-pointer"
              >
                Quick Enter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
