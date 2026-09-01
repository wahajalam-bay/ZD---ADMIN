import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/** Rendered when server-side authorization rejects access to a resource. */
export function AccessDenied({ message }: { message?: string }) {
  return (
    <div
      data-testid="access-denied"
      className="mx-auto mt-16 max-w-md rounded-card border border-line bg-panel px-6 py-10 text-center shadow-card"
    >
      <ShieldAlert className="mx-auto h-8 w-8 text-bad" aria-hidden />
      <h1 className="mt-3 text-[16px] font-bold">Access denied</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        {message ?? "You do not have permission to view this resource."}
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-[13px] font-semibold hover:bg-slate-50"
      >
        Back to home
      </Link>
    </div>
  );
}
