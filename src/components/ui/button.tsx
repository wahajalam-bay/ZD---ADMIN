import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  default:
    "border border-line bg-panel text-ink hover:bg-panel2 hover:border-gsoft disabled:hover:bg-panel",
  primary:
    "border border-transparent bg-grad-green text-white shadow-[0_3px_10px_-2px_rgba(13,122,63,0.5)] hover:brightness-110 hover:-translate-y-px",
  ghost: "border border-transparent bg-transparent text-accent-dark hover:bg-accent-light",
  danger: "border border-bad bg-panel text-bad hover:bg-bad-bg",
  dark: "border border-accent-deep bg-accent-deep text-white hover:bg-accent-dark",
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
        "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:brightness-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
