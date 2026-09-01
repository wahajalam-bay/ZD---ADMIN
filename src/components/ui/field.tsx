import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("t-label mb-1.5 block text-muted", className)} {...props} />;
}

/**
 * 16px text on phones is deliberate: iOS Safari zooms the whole page when a
 * focused input is smaller than that. The 40px minimum height keeps the field
 * comfortable to tap; both tighten to the dense desktop scale from `sm` up.
 */
const controlBase =
  "min-h-10 w-full rounded-input border border-line bg-panel px-3 py-2 text-[16px] text-ink transition-colors placeholder:text-muted/60 hover:border-line-strong disabled:bg-panel2 disabled:text-muted sm:min-h-0 sm:px-2.5 sm:text-[12.5px]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlBase, "leading-relaxed", className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(controlBase, "py-2", className)} {...props} />;
});

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-[11.5px] font-medium text-bad">
      {message}
    </p>
  );
}
