import type { ThemeId } from '../music/types';

interface ThemedNoteheadProps {
  theme: ThemeId;
  isWrong?: boolean;
}

/**
 * Renders the active notehead centered precisely at (0, 0).
 * Vertical extent stays within [-10, +10] so line vs. space placement
 * remains crystal-clear on a staff with LINE_GAP = 20.
 */
export function ThemedNotehead({ theme, isWrong = false }: ThemedNoteheadProps) {
  const wrongRing = isWrong ? (
    <circle
      cx="0"
      cy="0"
      r="19"
      fill="rgba(239, 68, 68, 0.24)"
      stroke="#ef4444"
      strokeWidth="3"
    />
  ) : null;

  switch (theme) {
    case 'classic':
      return (
        <g>
          {wrongRing}
          <ellipse
            cx="0"
            cy="0"
            rx="13.5"
            ry="9.5"
            transform="rotate(-16)"
            fill={isWrong ? '#dc2626' : '#1c1917'}
          />
          <ellipse
            cx="0"
            cy="0"
            rx="6.2"
            ry="3.6"
            transform="rotate(24)"
            fill="#faf5e8"
            opacity="0.92"
          />
        </g>
      );

    case 'chalkboard':
      return (
        <g>
          {wrongRing}
          <ellipse
            cx="0"
            cy="0"
            rx="13.5"
            ry="9.5"
            transform="rotate(-16)"
            fill={isWrong ? '#f87171' : '#f8fafc'}
          />
          <ellipse
            cx="0"
            cy="0"
            rx="6"
            ry="3.4"
            transform="rotate(24)"
            fill="#1e2923"
          />
        </g>
      );

    case 'pastel':
      return (
        <g>
          {wrongRing}
          <ellipse
            cx="0"
            cy="0"
            rx="14"
            ry="9.8"
            transform="rotate(-12)"
            fill={isWrong ? '#ef4444' : '#ffffff'}
            stroke={isWrong ? '#b91c1c' : '#312e81'}
            strokeWidth="2.5"
          />
        </g>
      );

    case 'fruit-smash':
      return (
        <g>
          {wrongRing}
          {/* Strawberry body centered on line/space */}
          <path
            d="M-12 -3 C-12 -10 12 -10 12 -3 C12 5 6 11 0 11 C-6 11 -12 5 -12 -3 Z"
            fill={isWrong ? '#991b1b' : '#ef4444'}
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* Green leafy crown */}
          <path
            d="M-7 -8 L-3 -13 L0 -9 L3 -13 L7 -8 L2 -6 L-2 -6 Z"
            fill="#22c55e"
          />
          {/* Seeds */}
          <circle cx="-4" cy="-1" r="1.2" fill="#fef08a" />
          <circle cx="4" cy="-1" r="1.2" fill="#fef08a" />
          <circle cx="0" cy="4" r="1.2" fill="#fef08a" />
        </g>
      );

    case 'cute-bird':
      return (
        <g>
          {wrongRing}
          {/* Round bird body */}
          <ellipse
            cx="0"
            cy="0"
            rx="13"
            ry="10"
            fill={isWrong ? '#991b1b' : '#ef4444'}
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* Wing */}
          <ellipse cx="-4" cy="2" rx="5.5" ry="3.8" fill="#dc2626" />
          {/* Eyes */}
          <circle cx="3.5" cy="-2.5" r="3" fill="#ffffff" />
          <circle cx="4.2" cy="-2.5" r="1.5" fill="#0f172a" />
          {/* Beak */}
          <polygon points="11,-2 17,0.5 11,3" fill="#facc15" />
        </g>
      );

    case 'space':
      return (
        <g>
          {wrongRing}
          {/* Back ring arc */}
          <ellipse
            cx="0"
            cy="0"
            rx="21"
            ry="5.5"
            transform="rotate(-18)"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="2.8"
          />
          {/* Planet core */}
          <circle
            cx="0"
            cy="0"
            r="9.8"
            fill={isWrong ? '#ef4444' : '#fbbf24'}
            stroke="#ffffff"
            strokeWidth="1.6"
          />
          {/* Front ring highlight */}
          <path
            d="M-19 5 Q0 10 19 -5"
            fill="none"
            stroke="#a5f3fc"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      );

    case 'ladybug':
      return (
        <g>
          {wrongRing}
          <ellipse
            cx="0"
            cy="0"
            rx="12.5"
            ry="9.8"
            fill={isWrong ? '#7f1d1d' : '#ef4444'}
            stroke="#ffffff"
            strokeWidth="1.8"
          />
          {/* Black head */}
          <path d="M7 -6 A9 9 0 0 1 7 6 Z" fill="#18181b" />
          {/* Center wing split & spots */}
          <line x1="-12" y1="0" x2="7" y2="0" stroke="#18181b" strokeWidth="1.6" />
          <circle cx="-4" cy="-4" r="2" fill="#18181b" />
          <circle cx="-4" cy="4" r="2" fill="#18181b" />
          <circle cx="2" cy="-4.5" r="1.6" fill="#18181b" />
          <circle cx="2" cy="4.5" r="1.6" fill="#18181b" />
        </g>
      );

    case 'basketball':
      return (
        <g>
          {wrongRing}
          <circle
            cx="0"
            cy="0"
            r="10.2"
            fill={isWrong ? '#dc2626' : '#f97316'}
            stroke="#ffffff"
            strokeWidth="1.8"
          />
          <line x1="-10" y1="0" x2="10" y2="0" stroke="#292524" strokeWidth="1.4" />
          <line x1="0" y1="-10" x2="0" y2="10" stroke="#292524" strokeWidth="1.4" />
          <path
            d="M-6 -8 Q-1 0 -6 8 M6 -8 Q1 0 6 8"
            fill="none"
            stroke="#292524"
            strokeWidth="1.3"
          />
        </g>
      );

    case 'soccer':
      return (
        <g>
          {wrongRing}
          <circle
            cx="0"
            cy="0"
            r="10.2"
            fill="#ffffff"
            stroke={isWrong ? '#ef4444' : '#0f172a'}
            strokeWidth="2"
          />
          <polygon points="0,-4.5 4.3,-1.4 2.7,3.6 -2.7,3.6 -4.3,-1.4" fill="#0f172a" />
          <circle cx="-7.5" cy="-4" r="2.1" fill="#0f172a" />
          <circle cx="7.5" cy="-4" r="2.1" fill="#0f172a" />
          <circle cx="0" cy="8.2" r="2" fill="#0f172a" />
        </g>
      );

    case 'spooky':
      return (
        <g>
          {wrongRing}
          <path
            d="M-11 8 L-11 -2 A11 10 0 0 1 11 -2 L11 8 L6 5 L0 8 L-6 5 Z"
            fill={isWrong ? '#fda4af' : '#f8fafc'}
            stroke="#c084fc"
            strokeWidth="1.6"
          />
          <circle cx="-4" cy="-2" r="2" fill="#1e1b4b" />
          <circle cx="4" cy="-2" r="2" fill="#1e1b4b" />
          <ellipse cx="0" cy="3" rx="2.4" ry="1.8" fill="#1e1b4b" />
        </g>
      );
  }
}
