import React from 'react';

interface SVTLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
}

/**
 * SVT Official Circular Logo Emblem
 * Vector SVG matching the store branding for Sri Venkateswara (SVT)
 * Features outer circular badge, emerald green core disc, silver metallic arc, and stylized "SVT" lettering.
 */
export const SVTLogo: React.FC<SVTLogoProps> = ({
  className = '',
  size = 36,
  showText = false,
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(size as string, 10) || 36;

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="shrink-0 overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle drop shadow */}
          <filter id="svt-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.35" />
          </filter>

          {/* Emerald Green gradient for inner circle */}
          <radialGradient id="svt-green" cx="42%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="45%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#0f4d26" />
          </radialGradient>

          {/* Silver metallic arc gradient */}
          <linearGradient id="svt-silver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="35%" stopColor="#94a3b8" />
            <stop offset="70%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Outer ring accent */}
          <linearGradient id="svt-outer-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          {/* Red/maroon rim glow matching card */}
          <radialGradient id="svt-rim" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="94%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#881337" stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Outer Red/Maroon Border Ring (from card) */}
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#991b1b" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="48" fill="url(#svt-rim)" />

        {/* White Inner Cushion Ring */}
        <circle cx="50" cy="50" r="42" fill="#ffffff" stroke="url(#svt-outer-ring)" strokeWidth="1.5" />

        {/* Core Emerald Green Disc */}
        <circle cx="50" cy="50" r="34" fill="url(#svt-green)" filter="url(#svt-shadow)" />

        {/* Silver Metallic Crescent Arc hugging left side */}
        <path
          d="M 50 16 A 34 34 0 0 0 20 62 A 34 34 0 0 0 54 84 L 54 74 A 24 24 0 0 1 29 55 A 24 24 0 0 1 50 26 Z"
          fill="url(#svt-silver)"
          opacity="0.95"
        />

        {/* Gloss highlight on top half of green sphere */}
        <ellipse cx="50" cy="27" rx="19" ry="8" fill="#ffffff" opacity="0.18" />

        {/* White SVT Bold Letters (Stacked / Stylized) */}
        {/* S */}
        <text
          x="35"
          y="42"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="17"
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing="-0.5"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          S
        </text>
        {/* V */}
        <text
          x="50"
          y="58"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="22"
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing="-1"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
        >
          V
        </text>
        {/* T */}
        <text
          x="65"
          y="74"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="17"
          fill="#ffffff"
          textAnchor="middle"
          letterSpacing="-0.5"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          T
        </text>
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-black tracking-wide text-xs text-slate-900">SRI VENKATESWARA</span>
          <span className="text-[10px] text-slate-500 font-medium">SVT TRADERS</span>
        </div>
      )}
    </div>
  );
};
