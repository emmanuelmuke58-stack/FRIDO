import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

// Capture beforeinstallprompt globally so early events or component remounts never miss it
let capturedInstallPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedInstallPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    capturedInstallPrompt = null;
    promptListeners.forEach((cb) => cb());
  });
}

export function usePWAInstall() {
  const [hasPrompt, setHasPrompt] = useState(() => Boolean(capturedInstallPrompt));
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const nav = navigator as NavigatorWithStandalone;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    setIsInstalled(standalone);

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios && !standalone);

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const syncPrompt = () => {
      setHasPrompt(Boolean(capturedInstallPrompt));
    };

    const handleInstalled = () => {
      capturedInstallPrompt = null;
      setHasPrompt(false);
      setIsInstalled(true);
    };

    promptListeners.add(syncPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      promptListeners.delete(syncPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!capturedInstallPrompt) return false;
    await capturedInstallPrompt.prompt();
    const { outcome } = await capturedInstallPrompt.userChoice;
    capturedInstallPrompt = null;
    promptListeners.forEach((cb) => cb());
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  }, []);

  return {
    isInstallable: hasPrompt,
    isInstalled,
    isIOS,
    isInIframe,
    install,
  };
}
