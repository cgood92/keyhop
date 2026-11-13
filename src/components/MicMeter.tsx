import { Volume2 } from 'lucide-react';

interface MicMeterProps {
  rms: number;
  threshold: number;
  heardNote: string;
}

export function MicMeter({ rms, threshold, heardNote }: MicMeterProps) {
  // Perceptual sqrt curve so normal mezzo-piano playing fills ~30-75% of the bar
  const toMeterPct = (val: number) =>
    Math.min(100, Math.round(Math.sqrt(Math.max(0, val) / 0.05) * 100));

  const pct = toMeterPct(rms);
  const thresholdPct = Math.min(95, toMeterPct(threshold));
  const active = rms >= threshold;

  return (
    <div className="flex items-center gap-3 rounded-full bg-slate-900/75 px-4 py-2 text-white shadow-lg backdrop-blur-md border border-white/20">
      <Volume2 size={18} className={active ? 'text-amber-300' : 'text-white/60'} />
      <div className="relative h-3 w-36 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all duration-75 ${
            active ? 'bg-amber-400' : 'bg-sky-300/70'
          }`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80"
          style={{ left: `${thresholdPct}%` }}
          title="Noise gate threshold"
        />
      </div>
      <span className="min-w-[3.2rem] text-right font-mono text-xs font-bold text-amber-200">
        {heardNote || '—'}
      </span>
    </div>
  );
}
