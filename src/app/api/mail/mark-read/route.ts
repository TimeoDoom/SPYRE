import { NextResponse } from "next/server";
import { markMessagesAsSeen } from "@/lib/gmail";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const id = body?.id;
    const mailbox = body?.mailbox || "INBOX";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await markMessagesAsSeen([String(id)], mailbox);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/mail/mark-read error", e);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
