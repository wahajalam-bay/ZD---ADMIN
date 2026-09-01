import * as React from "react";

/**
 * Radial progress ring (§3 "KPI vs target → bullet | gauge | progress ring").
 * Inline SVG, token-coloured, with a centred value + caption.
 */
export function ProgressRing({
  value,
  size = 132,
  thickness = 12,
  color = "var(--c1)",
  track = "var(--neutral-track)",
  caption,
  display,
  ariaLabel,
}: {
  /** 0–100, or null when there is nothing to measure. */
  value: number | null;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  caption: string;
  display?: string;
  ariaLabel: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {value !== null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray .5s var(--ease)" }}
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[22px] leading-none font-bold text-ink">
          {display ?? (value === null ? "—" : `${Math.round(value)}%`)}
        </span>
        <span className="t-label mt-1 text-muted">{caption}</span>
      </div>
    </div>
  );
}
