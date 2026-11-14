import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  MonitorDown,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';
import { cn } from '@/src/lib/utils';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'mobile-header' | 'drawer' | 'footer';
  className?: string;
}

export function PWAInstallButton({ variant = 'topbar', className }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Only hide when already launched as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted && !isInstallable) {
        return;
      }
      return;
    }
    setShowGuideModal(true);
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <>
      {variant === 'topbar' && (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap',
            className
          )}
        >
          <Download size={13} aria-hidden="true" />
          <span>Install App</span>
        </button>
      )}

      {variant === 'mobile-header' && (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Install Web App"
          title="Install Web App"
          className={cn(
            'min-h-[40px] inline-flex items-center gap-1 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap',
            className
          )}
        >
          <Download size={14} aria-hidden="true" />
          <span className="hidden min-[360px]:inline">App</span>
        </button>
      )}

      {variant === 'drawer' && (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer',
            className
          )}
        >
          <Smartphone size={16} aria-hidden="true" />
          <span>Install Web App</span>
        </button>
      )}

      {variant === 'footer' && (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-[#14B8A6] border border-white/20 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer',
            className
          )}
        >
          <Download size={14} aria-hidden="true" />
          <span>Install Web App</span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 text-[#102B4E] shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
                  alt="Rwanda Opportunities"
                  className="w-11 h-11 rounded-xl border border-slate-200 shrink-0"
                />
                <div>
                  <h2 id="pwa-install-guide-title" className="text-base font-bold text-[#083D91]">
                    Install Rwanda Opportunities
                  </h2>
                  <p className="text-xs text-slate-500">
                    Use Rwanda Opportunities like a native app on your device
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close install instructions"
              >
                <X size={18} />
              </button>
            </div>

            {isInIframe ? (
              <div className="space-y-4 mb-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  You are currently viewing this site inside an embedded preview window. Browsers
                  require opening the app in its own tab before installing it to your home screen
                  or desktop.
                </p>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-white text-sm font-bold transition-colors px-4 py-2.5"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  <span>Open Standalone Tab to Install</span>
                </a>
              </div>
            ) : isIOS ? (
              <ol className="space-y-3 text-sm text-slate-700 mb-5">
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-[#083D91] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Tap the <Share size={16} className="text-[#083D91] inline" />{' '}
                    <strong>Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-[#083D91] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Scroll and tap <PlusSquare size={16} className="text-[#14B8A6] inline" />{' '}
                    <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-[#083D91] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top-right corner to launch as a standalone app.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700 mb-5">
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-[#083D91] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Look for the <MonitorDown size={16} className="text-[#083D91] inline" />{' '}
                    <strong>Install</strong> icon in your browser&apos;s address bar, or open the
                    browser menu (<strong>⋮</strong>).
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-[#083D91] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Select <strong>Install Rwanda Opportunities</strong> or{' '}
                    <strong>Add to Home screen</strong>.
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-[#083D91] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>Launch anytime from your home screen, dock, or desktop apps list.</span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
