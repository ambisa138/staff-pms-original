import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if not already in standalone mode
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:bottom-8 md:left-auto md:right-8 z-[100] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-primary text-white rounded-2xl shadow-2xl p-6 border border-white/10 flex items-center gap-6 max-w-sm">
        <div className="bg-accent p-3 rounded-xl shadow-lg">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm">Install Staff Pro Max</h4>
          <p className="text-[10px] text-white/70 font-medium mt-1 leading-relaxed">
            Install on your home screen for offline access and instant notifications.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleInstall}
            className="bg-white text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight hover:bg-slate-100 transition-all"
          >
            Install
          </button>
          <button 
            onClick={() => setShowPrompt(false)}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5 mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
};
