import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

export type RadarAxis = { key: string; label: string; value: number };

const DEFAULT_AXES: RadarAxis[] = [
  { key: "identity", label: "Identity", value: 0 },
  { key: "income", label: "Income", value: 0 },
  { key: "employment", label: "Employment", value: 0 },
  { key: "residence", label: "Residence", value: 0 },
];

export function ConfidenceRadar({
  size = 260,
  axes: axesProp,
}: {
  size?: number;
  axes?: RadarAxis[];
}) {
  const axes = axesProp && axesProp.length >= 3 ? axesProp : DEFAULT_AXES;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;

  const p = useMotionValue(0);

  useEffect(() => {
    const c = animate(p, 1, { duration: 1.2, ease: [0.2, 0.8, 0.2, 1] });
    return c.stop;
  }, [p]);

  function pt(i: number, v: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (r * v) / 100;
    return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)] as const;
  }

  const path = useTransform(p, (t) => {
    const pts = axes.map((a, i) => pt(i, a.value * t));
    return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") + " Z";
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.15" />
          </radialGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={axes
              .map((_, i) => {
                const [x, y] = pt(i, 100 * f);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
        })}
        <motion.path d={path} fill="url(#radar-fill)" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const lx = cx + (r + 20) * Math.cos(angle);
          const ly = cy + (r + 20) * Math.sin(angle);
          return (
            <g key={a.key}>
              <circle cx={x} cy={y} r={3} fill="#2563EB" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        {axes.map((a) => (
          <div key={a.key} className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{a.label}</span>
            <span className="font-semibold tabular-nums">{Math.round(a.value)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
