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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[17px] font-extrabold tracking-wide">ZAMEEN DEVELOPMENTS</h1>
          <p className="mt-1 text-xs tracking-wider text-muted uppercase">
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
