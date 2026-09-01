import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Authoritative session check (a mere cookie is not enough — it may be stale).
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      {/* Bayut hero backdrop — the brand block above the card sits on it */}
      <div
        className="absolute inset-x-0 top-0 h-[52vh] min-h-[320px]"
        style={{ background: "var(--grad-hero)" }}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-white to-[#d8f0e2] text-lg font-bold text-accent-deep shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.6)]"
          >
            ZA
          </span>
          <h1 className="mt-4 text-[19px] font-bold tracking-[0.2px] text-white">
            Zameen Developments
          </h1>
          <p className="mt-1 text-[10.5px] font-semibold tracking-[1px] text-white/75 uppercase">
            Admin Properties · Operations &amp; Command Center
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          Accounts are created by a Manager/Admin. If you cannot sign in or need a
          password reset, contact your administrator.
        </p>
      </div>
    </main>
  );
}
