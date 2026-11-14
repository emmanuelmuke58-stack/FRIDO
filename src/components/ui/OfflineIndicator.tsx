import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 md:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-[70] bg-[#102B4E] text-white border border-teal-400/30 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2.5 text-xs font-semibold"
    >
      <WifiOff size={16} className="text-[#14B8A6] shrink-0" aria-hidden="true" />
      <span>You are offline. Viewing cached pages.</span>
    </div>
  );
}
