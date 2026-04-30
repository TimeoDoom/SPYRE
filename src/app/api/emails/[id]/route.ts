import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not available" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "INBOX";
  const dbId = `${folder}:${id}`;

  try {
    const email = await prisma.emailMetadata.findUnique({
      where: { id: dbId },
      select: {
        uid: true,
        folder: true,
        subject: true,
        from: true,
        to: true,
        cc: true,
        date: true,
        snippet: true,
        seen: true,
        hasAttachments: true,
        bodyText: true,
        bodyHtml: true,
        messageId: true,
        inReplyTo: true,
        references: true,
        threadId: true,
        attachments: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Marquer comme lu
    await prisma.emailMetadata.update({
      where: { id: dbId },
      data: { seen: true },
    });

    const transformed = {
      id: email.uid,
      mailbox: email.folder,
      threadId: email.threadId,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: JSON.parse(email.references || "[]"),
      senderEmail: extractEmail(email.from),
      from: email.from,
      to: email.to,
      cc: email.cc,
      subject: email.subject,
      date: new Date(email.date).toLocaleString(),
      dateIso: new Date(email.date).toISOString(),
      snippet: email.snippet,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      attachments: JSON.parse(email.attachments || "[]"),
      seen: true,
    };

    return NextResponse.json({ ok: true, message: transformed });
  } catch (error) {
    console.error("[emails/id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 },
    );
  }
}

function extractEmail(from: string): string {
  const match = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}
