"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

/** Human-readable failure surface (§4 states). Never exposes internals. */
export function ErrorState({
  title = "We couldn't load this data",
  detail,
  onRetry,
  retryLabel = "Retry",
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-card border border-line bg-panel px-5 py-8 text-center shadow-card"
    >
      <span className="grid h-9 w-9 place-items-center rounded-tile bg-warn-bg text-warn">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
      </span>
      <p className="t-card mt-1">{title}</p>
      {detail ? <p className="max-w-md text-[12.5px] text-muted">{detail}</p> : null}
      {onRetry ? (
        <Button className="mt-2" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
