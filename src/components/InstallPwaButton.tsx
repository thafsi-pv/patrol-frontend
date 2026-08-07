import { useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaButton() {
  const [installable, setInstallable] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Hide button if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstallable(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const choice = await deferredPrompt.current.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallable(false);
    }
    deferredPrompt.current = null;
  };

  if (!installable) return null;

  return (
    <button
      onClick={handleInstall}
      title="Install Patrol System as app"
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-brand-500/15 border border-brand-500/30 text-brand-300 hover:bg-brand-500/25 transition-all duration-200 group"
    >
      <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Install App
    </button>
  );
}
