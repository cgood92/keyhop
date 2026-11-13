import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenButtonProps {
  isFullscreen: boolean;
  isSupported: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function FullscreenButton({
  isFullscreen,
  isSupported,
  onToggle,
  compact = false,
}: FullscreenButtonProps) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen (F)'}
      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      className={`inline-flex items-center gap-2 rounded-full bg-white/90 font-bold text-slate-800 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white active:scale-95 ${
        compact ? 'h-10 w-10 justify-center' : 'px-3.5 py-2 text-xs sm:text-sm'
      }`}
    >
      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      {!compact && <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>}
    </button>
  );
}
