import Link from "next/link";
import { requirePropertyByCode, AuthorizationError, AuthenticationError } from "@/server/permissions";
import { AccessDenied } from "@/components/shell/access-denied";
import { redirect } from "next/navigation";
import { EntryTabs } from "@/features/entry/entry-tabs";

export const dynamic = "force-dynamic";

/**
 * Server-side property gate for the whole /entry/[propertyCode] subtree:
 * a site user reaching another property's URL gets an explicit access-denied
 * page — enforcement lives in requirePropertyByCode, not in hidden links.
 */
export default async function EntryPropertyLayout({
  params,
  children,
}: {
  params: Promise<{ propertyCode: string }>;
  children: React.ReactNode;
}) {
  const { propertyCode } = await params;
  let property;
  try {
    ({ property } = await requirePropertyByCode(propertyCode));
  } catch (err) {
    if (err instanceof AuthenticationError) redirect("/login");
    if (err instanceof AuthorizationError) {
      return <AccessDenied message={err.message} />;
    }
    throw err;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/entry"
            className="inline-flex min-h-9 items-center text-[13px] font-semibold text-accent-dark hover:underline sm:min-h-0 sm:text-xs"
          >
            ← Data Entry
          </Link>
          <h2 className="mt-0.5 text-[20px] font-bold" data-testid="entry-property-name">
            {property.name}
          </h2>
        </div>
        <EntryTabs propertyCode={property.code} />
      </div>
      {children}
    </div>
  );
}
