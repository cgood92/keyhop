import type { ThemeId } from '../music/types';

export function ThemeBackdrop({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case 'classic':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, #fcf8ee 0%, #efe3c8 68%, #dec9a4 100%)',
          }}
        >
          <svg
            className="h-full w-full opacity-20"
            preserveAspectRatio="none"
            viewBox="0 0 1200 800"
          >
            <circle cx="150" cy="140" r="240" fill="#c2a475" opacity="0.25" />
            <circle cx="1040" cy="650" r="280" fill="#b48f5a" opacity="0.25" />
          </svg>
        </div>
      );

    case 'fruit-smash':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #064e3b 0%, #047857 48%, #022c22 100%)',
          }}
        >
          <svg
            className="h-full w-full"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            {/* Tropical jungle leaves */}
            <path d="M-40 160 Q140 60 280 180 Q130 250 -40 160 Z" fill="#10b981" opacity="0.25" />
            <path d="M-20 40 Q190 -20 310 90 Q120 150 -20 40 Z" fill="#34d399" opacity="0.2" />
            <path d="M1240 120 Q1030 30 920 160 Q1080 220 1240 120 Z" fill="#10b981" opacity="0.24" />
            <path d="M1230 680 Q1000 560 880 720 Q1060 790 1230 680 Z" fill="#059669" opacity="0.45" />
            <path d="M-30 710 Q180 560 320 730 Q140 820 -30 710 Z" fill="#059669" opacity="0.45" />
            <circle cx="240" cy="180" r="95" fill="#6ee7b7" opacity="0.08" />
            <circle cx="960" cy="240" r="140" fill="#34d399" opacity="0.08" />
          </svg>
        </div>
      );

    case 'cute-bird':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 58%, #bbf7d0 100%)',
          }}
        >
          <svg
            className="h-full w-full"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            {/* Sun */}
            <circle cx="1030" cy="120" r="70" fill="#fef08a" opacity="0.85" />
            {/* Puffy clouds */}
            <g fill="#ffffff" opacity="0.72">
              <circle cx="200" cy="140" r="46" />
              <circle cx="245" cy="130" r="56" />
              <circle cx="295" cy="145" r="42" />
              <circle cx="780" cy="180" r="38" />
              <circle cx="820" cy="168" r="48" />
              <circle cx="865" cy="182" r="36" />
            </g>
            {/* Rolling green hills */}
            <path d="M0 640 Q320 530 660 630 T1200 600 L1200 800 L0 800 Z" fill="#4ade80" />
            <path d="M0 700 Q400 610 820 700 T1200 670 L1200 800 L0 800 Z" fill="#22c55e" />
          </svg>
        </div>
      );

    case 'space':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at 25% 20%, #4c1d95 0%, #1e1b4b 45%, #090d1f 100%)',
          }}
        >
          <svg
            className="h-full w-full"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            <circle cx="950" cy="160" r="180" fill="#06b6d4" opacity="0.14" />
            <circle cx="210" cy="640" r="220" fill="#c026d3" opacity="0.14" />
            {[
              [110, 90, 2.5],
              [260, 180, 1.8],
              [420, 70, 2.2],
              [590, 140, 1.6],
              [780, 90, 2.6],
              [1040, 130, 2],
              [150, 420, 1.8],
              [1090, 460, 2.4],
              [340, 710, 2.1],
              [670, 690, 1.7],
              [930, 670, 2.5],
              [480, 250, 1.4],
              [840, 320, 1.5],
              [180, 560, 2.1],
            ].map(([cx, cy, r], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="#ffffff"
                opacity={i % 2 === 0 ? 0.85 : 0.45}
              />
            ))}
          </svg>
        </div>
      );

    case 'chalkboard':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 45%, #23332c 0%, #16211c 75%, #0f1713 100%)',
          }}
        >
          <div
            className="absolute inset-4 rounded-2xl border-8 border-amber-900/50 opacity-70"
            aria-hidden="true"
          />
        </div>
      );

    case 'ladybug':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(155deg, #65a30d 0%, #3f6212 55%, #1a2e05 100%)',
          }}
        >
          <svg
            className="h-full w-full"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            <circle cx="190" cy="140" r="110" fill="#fef08a" opacity="0.16" />
            <circle cx="980" cy="200" r="150" fill="#bef264" opacity="0.14" />
            <circle cx="1050" cy="650" r="95" fill="#fef08a" opacity="0.15" />
            {/* Daisy flower accent in bottom corner */}
            <g transform="translate(130 690)" opacity="0.35">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy="-42"
                  rx="16"
                  ry="32"
                  fill="#ffffff"
                  transform={`rotate(${deg})`}
                />
              ))}
              <circle cx="0" cy="0" r="24" fill="#facc15" />
            </g>
          </svg>
        </div>
      );

    case 'basketball':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #d97706 0%, #b45309 55%, #78350f 100%)',
          }}
        >
          <svg
            className="h-full w-full opacity-20"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            <circle cx="600" cy="400" r="190" fill="none" stroke="#fff7ed" strokeWidth="8" />
            <line x1="600" y1="0" x2="600" y2="800" stroke="#fff7ed" strokeWidth="6" />
            <circle cx="0" cy="400" r="230" fill="none" stroke="#fff7ed" strokeWidth="8" />
            <circle cx="1200" cy="400" r="230" fill="none" stroke="#fff7ed" strokeWidth="8" />
          </svg>
        </div>
      );

    case 'soccer':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              'repeating-linear-gradient(90deg, #15803d 0px, #15803d 120px, #166534 120px, #166534 240px)',
          }}
        >
          <svg
            className="h-full w-full opacity-25"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            <rect
              x="40"
              y="40"
              width="1120"
              height="720"
              fill="none"
              stroke="#ffffff"
              strokeWidth="6"
            />
            <line x1="600" y1="40" x2="600" y2="760" stroke="#ffffff" strokeWidth="6" />
            <circle cx="600" cy="400" r="120" fill="none" stroke="#ffffff" strokeWidth="6" />
          </svg>
        </div>
      );

    case 'spooky':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1e1b4b 0%, #4c1d95 55%, #17092b 100%)',
          }}
        >
          <svg
            className="h-full w-full"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            <circle cx="960" cy="145" r="82" fill="#fde68a" opacity="0.82" />
            <path d="M0 710 Q300 640 600 710 T1200 680 L1200 800 L0 800 Z" fill="#090514" opacity="0.7" />
            {/* Distant bats */}
            <path
              d="M220 170 Q235 150 250 170 Q265 150 280 170 Q260 168 250 180 Q240 168 220 170 Z"
              fill="#090514"
              opacity="0.6"
            />
            <path
              d="M320 120 Q332 105 344 120 Q356 105 368 120 Q352 118 344 128 Q336 118 320 120 Z"
              fill="#090514"
              opacity="0.5"
            />
          </svg>
        </div>
      );

    case 'pastel':
      return (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #8b5cf6 0%, #6366f1 42%, #06b6d4 100%)',
          }}
        >
          <svg
            className="h-full w-full opacity-20"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1200 800"
          >
            <circle cx="180" cy="180" r="210" fill="#ffffff" />
            <circle cx="1020" cy="640" r="250" fill="#ffffff" />
          </svg>
        </div>
      );
  }
}
