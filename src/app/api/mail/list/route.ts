import { NextResponse } from "next/server";
import { listMailboxThreads } from "@/lib/gmail";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const box = url.searchParams.get("box") || "inbox";
  const limitParam = Number(url.searchParams.get("limit") || "20");
  const before = url.searchParams.get("before") || undefined;
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(100, Math.floor(limitParam))
      : 20;

  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const systemBoxes = {
      inbox: "INBOX",
      spam: "[Gmail]/Spam",
      trash: "[Gmail]/Trash",
      drafts: "[Gmail]/Drafts",
    } as Record<string, string>;

    const mailboxName = systemBoxes[box] || "INBOX";

    // Request a larger window and then paginate client-side by uid comparison.
    const all = await listMailboxThreads(mailboxName, 250);

    // all is newest-first. If `before` is provided, return items with id < before.
    const rows = all
      .filter((r: any) => {
        if (!before) return true;
        const bi = Number(before);
        const idn = Number(r.id);
        return Number.isFinite(idn) && idn < bi;
      })
      .slice(0, limit);

    const nextCursor = rows.length ? rows[rows.length - 1].id : null;

    return NextResponse.json({ items: rows, nextCursor });
  } catch (e) {
    console.error("/api/mail/list error", e);
    return NextResponse.json(
      { error: "Failed to list mails" },
      { status: 500 },
    );
  }
}
