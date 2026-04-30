import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "INBOX";
  const limit = Math.min(50, Number(url.searchParams.get("limit") || "20"));
  const before = url.searchParams.get("before");

  try {
    const emails = await prisma.emailMetadata.findMany({
      where: {
        folder,
        ...(before ? { 
          date: { lt: new Date(before) } 
        } : {}),
      },
      orderBy: { date: "desc" },
      take: limit + 1,
      select: {
        uid: true,
        folder: true,
        subject: true,
        from: true,
        to: true,
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

    const hasMore = emails.length > limit;
    const items = hasMore ? emails.slice(0, limit) : emails;
    
    // Transformer pour correspondre à l'API existante
    const transformed = items.map(email => ({
      id: email.uid,
      mailbox: email.folder,
      threadId: email.threadId,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: JSON.parse(email.references || "[]"),
      from: email.from,
      to: email.to,
      subject: email.subject,
      date: new Date(email.date).toLocaleString(),
      dateIso: new Date(email.date).toISOString(),
      snippet: email.snippet,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      seen: email.seen,
      hasAttachments: email.hasAttachments,
      attachments: JSON.parse(email.attachments || "[]"),
    }));

    return NextResponse.json({
      items: transformed,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("[emails] Error:", error);
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}