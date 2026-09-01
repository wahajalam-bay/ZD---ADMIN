import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger" | "dark" | "subtle";
type Size = "sm" | "md" | "lg";

/** Buttons use the 7px input radius (§1.4); green is reserved for the primary action. */
const variants: Record<Variant, string> = {
  default: "border border-line bg-panel text-ink hover:border-line-strong hover:bg-panel2",
  primary:
    "border border-transparent bg-[var(--grad-green)] text-white shadow-[0_3px_10px_-2px_rgba(13,122,63,0.45)] hover:brightness-110",
  ghost: "border border-transparent bg-transparent text-accent-dark hover:bg-accent-light",
  subtle: "border border-transparent bg-panel2 text-ink hover:bg-accent-light",
  danger: "border border-bad/40 bg-panel text-bad hover:bg-bad-bg",
  dark: "border border-transparent bg-accent-deep text-white hover:bg-accent-dark",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-[11.5px]",
  md: "px-3.5 py-2 text-[12.5px]",
  lg: "px-4 py-2.5 text-[13px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-input font-semibold transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
