// Self-contained decorative "green warehouse" scene (inline SVG, no external
// image) — a fresh eco warehouse with a living roof, solar panels, trees and
// floating leaves. Sits full-bleed behind content.
export function GreenWarehouseBg({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="gwSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eaf8ef" />
          <stop offset="0.55" stopColor="#dcf2e4" />
          <stop offset="1" stopColor="#cdecd8" />
        </linearGradient>
        <linearGradient id="gwRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#57b37e" />
          <stop offset="1" stopColor="#2f8f5b" />
        </linearGradient>
        <linearGradient id="gwHill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe6c9" />
          <stop offset="1" stopColor="#a6d9b3" />
        </linearGradient>
        <radialGradient id="gwSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6d6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect width="1200" height="800" fill="url(#gwSky)" />
      <circle cx="985" cy="150" r="180" fill="url(#gwSun)" />
      <circle cx="985" cy="150" r="52" fill="#ffe9a8" opacity="0.85" />

      {/* floating leaves */}
      <g fill="#7cc593" opacity="0.55">
        <path d="M150 120c40-18 78-6 92 26-38 16-78 6-92-26z" />
        <path d="M320 70c30 6 48 34 42 66-30-8-48-34-42-66z" opacity="0.8" />
        <path d="M760 96c34-20 74-12 92 18-34 22-74 14-92-18z" opacity="0.7" />
        <path d="M540 150c26 10 38 40 28 70-26-12-38-40-28-70z" opacity="0.6" />
      </g>

      {/* rolling hills */}
      <path d="M0 640 Q300 560 620 626 T1200 606 V800 H0 Z" fill="url(#gwHill)" />
      <path d="M0 700 Q360 640 760 700 T1200 686 V800 H0 Z" fill="#8fce9f" opacity="0.85" />

      {/* trees left */}
      <g>
        <rect x="118" y="560" width="14" height="70" rx="6" fill="#7a5a3a" />
        <circle cx="125" cy="540" r="46" fill="#3a9d6a" />
        <circle cx="95" cy="560" r="34" fill="#49ab77" />
        <circle cx="156" cy="560" r="34" fill="#2f8f5b" />
      </g>

      {/* warehouse building */}
      <g>
        {/* body */}
        <rect x="360" y="470" width="520" height="210" rx="14" fill="#fbfdfb" stroke="#dcebe1" strokeWidth="3" />
        {/* living green roof */}
        <path d="M348 476 Q620 388 892 476 L892 500 Q620 414 348 500 Z" fill="url(#gwRoof)" />
        <path d="M348 500 Q620 414 892 500 L892 476 Q620 388 348 476 Z" fill="#3a9d6a" opacity="0.35" />
        {/* little roof plants */}
        <g fill="#2f8f5b">
          <circle cx="470" cy="452" r="9" />
          <circle cx="560" cy="440" r="10" />
          <circle cx="660" cy="436" r="10" />
          <circle cx="760" cy="446" r="9" />
        </g>
        {/* solar panels */}
        <g fill="#2b6f8f" opacity="0.9">
          <rect x="430" y="500" width="150" height="40" rx="4" transform="skewX(-6)" />
          <rect x="640" y="500" width="150" height="40" rx="4" transform="skewX(-6)" />
        </g>
        <g stroke="#e8f5ec" strokeWidth="2" opacity="0.7">
          <line x1="470" y1="502" x2="455" y2="540" />
          <line x1="515" y1="502" x2="500" y2="540" />
          <line x1="680" y1="502" x2="665" y2="540" />
          <line x1="725" y1="502" x2="710" y2="540" />
        </g>
        {/* loading dock doors */}
        <g>
          <rect x="400" y="576" width="120" height="104" rx="8" fill="#eaf3ec" stroke="#cfe3d6" strokeWidth="3" />
          <rect x="560" y="576" width="120" height="104" rx="8" fill="#eaf3ec" stroke="#cfe3d6" strokeWidth="3" />
          <rect x="720" y="576" width="120" height="104" rx="8" fill="#eaf3ec" stroke="#cfe3d6" strokeWidth="3" />
          <g stroke="#d3e6d9" strokeWidth="2">
            <line x1="400" y1="606" x2="520" y2="606" />
            <line x1="400" y1="636" x2="520" y2="636" />
            <line x1="560" y1="606" x2="680" y2="606" />
            <line x1="560" y1="636" x2="680" y2="636" />
            <line x1="720" y1="606" x2="840" y2="606" />
            <line x1="720" y1="636" x2="840" y2="636" />
          </g>
        </g>
        {/* leaf emblem */}
        <g transform="translate(620,540)">
          <circle r="20" fill="#eaf7ef" stroke="#2f8f5b" strokeWidth="2.5" />
          <path d="M-8 6 Q0 -12 12 -8 Q6 8 -8 6 Z" fill="#2f8f5b" />
        </g>
      </g>

      {/* trees right */}
      <g>
        <rect x="930" y="556" width="16" height="78" rx="6" fill="#7a5a3a" />
        <circle cx="938" cy="536" r="52" fill="#2f8f5b" />
        <circle cx="905" cy="558" r="36" fill="#3a9d6a" />
        <circle cx="972" cy="556" r="36" fill="#49ab77" />
      </g>

      {/* foreground grass strip */}
      <path d="M0 748 Q300 726 600 748 T1200 740 V800 H0 Z" fill="#6ec084" />
    </svg>
  );
}
