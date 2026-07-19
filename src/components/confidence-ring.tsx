import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

export function ConfidenceRing({
  value,
  size = 220,
  stroke = 14,
  label = "Rental Confidence",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const progress = useMotionValue(0);
  const dash = useTransform(progress, (v) => c - (v / 100) * c);
  const display = useTransform(progress, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(progress, value, {
      duration: 1.4,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return controls.stop;
  }, [progress, value]);

  const tier =
    value >= 90
      ? "Excellent"
      : value >= 75
        ? "Good"
        : value >= 60
          ? "Needs Attention"
          : "Poor";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 0.7, 0.4], scale: [0.85, 1.05, 1] }}
        transition={{ duration: 1.8, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute inset-4 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, #3B82F6 55%, transparent), transparent 70%)",
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: dash }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <motion.div className="text-5xl font-semibold tracking-tight tabular-nums md:text-6xl">
            <motion.span>{display}</motion.span>
            <span className="text-2xl text-muted-foreground">%</span>
          </motion.div>
          <div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-sm font-medium text-primary">{tier}</div>
        </div>
      </div>
    </div>
  );
}
