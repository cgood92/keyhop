import { Diamond, Star } from 'lucide-react';

interface StarRatingProps {
  stars: number; // 0..5
  diamondPerfect?: boolean;
  size?: 'sm' | 'md' | 'lg';
  arc?: boolean;
}

export function StarRating({
  stars,
  diamondPerfect = false,
  size = 'md',
  arc = false,
}: StarRatingProps) {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 40 : 22;

  return (
    <div className="flex items-center justify-center gap-1.5" aria-label={`${stars} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((idx) => {
        const earned = idx <= stars;
        // Slight arc lift on center stars for results celebration
        const arcOffset = arc
          ? idx === 3
            ? '-translate-y-3'
            : idx === 2 || idx === 4
              ? '-translate-y-1.5'
              : ''
          : '';

        if (diamondPerfect && earned) {
          return (
            <Diamond
              key={idx}
              size={iconSize}
              className={`${arcOffset} fill-cyan-300 text-sky-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.85)]`}
            />
          );
        }

        return (
          <Star
            key={idx}
            size={iconSize}
            className={`${arcOffset} transition-transform ${
              earned
                ? 'fill-amber-400 text-amber-300 drop-shadow-[0_2px_6px_rgba(251,191,36,0.5)]'
                : 'fill-black/20 text-white/30'
            }`}
          />
        );
      })}
    </div>
  );
}
