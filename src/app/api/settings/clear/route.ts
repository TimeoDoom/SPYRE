import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { clearMailSettings } from "@/lib/persist";

export const runtime = "nodejs";

function isTrustedPost(req: Request) {
  const reqUrl = new URL(req.url);

  const origin = req.headers.get("origin");
  if (origin) return origin === reqUrl.origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === reqUrl.origin;
    } catch {
      return false;
    }
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
  return secFetchSite === "same-origin" || secFetchSite === "same-site";
}

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);

  if (!isTrustedPost(req)) {
    const url = new URL("/settings", reqUrl.origin);
    url.searchParams.set("error", "CSRF blocked");
    return NextResponse.redirect(url, 303);
  }

  const session = await getSession();
  await clearMailSettings(session);

  return NextResponse.redirect(
    new URL("/settings?saved=1", reqUrl.origin),
    303,
  );
}
