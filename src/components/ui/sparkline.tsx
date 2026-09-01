import * as React from "react";

/**
 * Inline-SVG sparkline (§10 build guidance: inline SVG for many instances).
 * Decorative inside KPI cards — the numeric value carries the meaning.
 */
export function Sparkline({
  values,
  width = 92,
  height = 26,
  stroke = "var(--c1)",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points.at(-1)![0].toFixed(1)} ${height} L${points[0]![0].toFixed(1)} ${height} Z`;
  const last = points.at(-1)!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d={area} fill={stroke} opacity={0.12} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.1} fill={stroke} />
    </svg>
  );
}
