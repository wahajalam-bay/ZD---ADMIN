"use client";

import { Button } from "@/components/ui/button";

/** Global error boundary — friendly message, no internals leaked. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAuthz = error.name === "AuthorizationError";
  return (
    <div className="mx-auto mt-20 max-w-md rounded-card border border-line bg-panel px-6 py-10 text-center shadow-card">
      <h1 className="text-[16px] font-bold">{isAuthz ? "Access denied" : "Something went wrong"}</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        {isAuthz
          ? error.message
          : "An unexpected error occurred. Try again — if it keeps happening, contact the administrator."}
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-[11px] text-muted">Ref: {error.digest}</p>
      ) : null}
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
