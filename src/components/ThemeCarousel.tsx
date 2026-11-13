import type { ThemeId } from '../music/types';
import { THEMES } from '../themes/themeRegistry';
import { ThemedNotehead } from '../themes/ThemedNotehead';

interface ThemeCarouselProps {
  selectedTheme: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
}

export function ThemeCarousel({ selectedTheme, onSelectTheme }: ThemeCarouselProps) {
  return (
    <div className="no-scrollbar w-full max-w-4xl overflow-x-auto py-3">
      <div className="mx-auto flex w-max items-center gap-3.5 px-6">
        {THEMES.map((t) => {
          const active = t.id === selectedTheme;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTheme(t.id)}
              title={`${t.name} — ${t.tagline}`}
              aria-pressed={active}
              className={`group relative flex shrink-0 flex-col items-center gap-1.5 transition-transform focus:outline-none ${
                active ? 'scale-110' : 'opacity-80 hover:scale-105 hover:opacity-100'
              }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all ${
                  active
                    ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-900/40'
                    : 'ring-2 ring-white/40'
                }`}
                style={{ background: t.previewBg }}
              >
                <svg viewBox="-22 -18 44 36" className="h-9 w-11 overflow-visible">
                  <ThemedNotehead theme={t.id} />
                </svg>
              </div>
              <span
                className={`text-[11px] font-bold tracking-tight drop-shadow ${
                  active ? 'text-amber-200' : 'text-white/90'
                }`}
              >
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
