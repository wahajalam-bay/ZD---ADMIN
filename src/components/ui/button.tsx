import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  default:
    "border border-line bg-panel text-ink hover:bg-slate-50 disabled:hover:bg-panel",
  primary:
    "border border-accent bg-accent text-white hover:bg-accent-dark hover:border-accent-dark",
  ghost: "border border-transparent bg-transparent text-accent-dark hover:bg-accent-light",
  danger: "border border-bad bg-panel text-bad hover:bg-bad-bg",
  dark: "border border-ink bg-ink text-white hover:bg-slate-800",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-[13px]",
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
