/** Simple SVG donut built from stroked arc segments (no chart library). */
export function DonutChart({
  data,
  size = 172,
  thickness = 26,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const fracs = data.map((d) => d.value / total);
  const offsets = fracs.map((_, i) => fracs.slice(0, i).reduce((s, f) => s + f, 0));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="flex-none">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth={thickness} />
        {data.map((d, i) => {
          const seg = fracs[i] * C;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${seg} ${C - seg}`}
              strokeDashoffset={-offsets[i] * C}
            />
          );
        })}
      </g>
    </svg>
  );
}
