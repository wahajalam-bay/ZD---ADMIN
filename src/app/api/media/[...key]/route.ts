import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getStorage } from "@/server/storage";
import { propertyIdFromKey } from "@/server/storage/images";
import { canAccessProperty } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Authenticated media delivery. Objects live in a PRIVATE bucket/directory;
 * every read is authorized here: management sees all properties, a site user
 * only objects belonging to their own property (parsed from the object key,
 * which the server generated — never from client input).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { key: segments } = await ctx.params;
  const key = segments.join("/");
  if (key.includes("..") || !/^[a-zA-Z0-9/_.-]+$/.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const propertyId = propertyIdFromKey(key);
  if (!propertyId || !canAccessProperty(user, propertyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const object = await getStorage().get(key);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(object.body.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
