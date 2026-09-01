import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-20 max-w-md rounded-card border border-line bg-panel px-6 py-10 text-center shadow-card">
      <h1 className="font-mono text-3xl font-extrabold text-muted">404</h1>
      <p className="mt-2 text-[14px] font-bold">Page not found</p>
      <p className="mt-1 text-[13px] text-muted">
        The page you are looking for does not exist or the property is inactive.
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
