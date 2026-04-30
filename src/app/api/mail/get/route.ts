import { NextResponse } from "next/server";
import { getMessage } from "@/lib/gmail";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const mailbox = url.searchParams.get("mailbox") || "INBOX";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const start = Date.now();
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const msg = await getMessage(id, mailbox);
    const dur = Date.now() - start;
    return NextResponse.json(
      { ok: true, message: msg },
      { headers: { "Server-Timing": `getMessage;dur=${dur}` } },
    );
  } catch (e) {
    console.error("/api/mail/get error", e);
    return NextResponse.json(
      { error: "Failed to get message" },
      { status: 500 },
    );
  }
}
