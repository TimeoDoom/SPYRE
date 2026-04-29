import { NextResponse } from "next/server";
import { z } from "zod";
import { getMailboxes, moveMessageToMailbox } from "@/lib/gmail";
import { ensureDefaultSpace, getSession } from "@/lib/session";

export const runtime = "nodejs";

const ArchiveSchema = z.object({
  id: z.string().min(1),
  spaceId: z.string().min(1).optional(),
  box: z.enum(["inbox", "drafts", "spam", "trash"]).optional().default("inbox"),
});

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
  if (!isTrustedPost(req)) {
    return NextResponse.json(
      { ok: false, error: "CSRF blocked" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ArchiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Requête invalide" },
      { status: 400 },
    );
  }

  const { id, box } = parsed.data;
  const spaceId = parsed.data.spaceId || "principal";

  if (box === "trash") {
    return NextResponse.json(
      { ok: false, error: "Impossible d’archiver depuis la corbeille" },
      { status: 400 },
    );
  }
  if (box === "drafts") {
    return NextResponse.json(
      { ok: false, error: "Impossible d’archiver un brouillon" },
      { status: 400 },
    );
  }

  try {
    const systemBoxes = await getMailboxes();

    const mailboxName = (() => {
      if (box === "inbox") return "INBOX";
      if (box === "spam")
        return (
          systemBoxes.find((c) => c.label === "Spam")?.name || "[Gmail]/Spam"
        );
      return "INBOX";
    })();

    const allMailMailbox =
      systemBoxes.find((c) => c.label === "Tous les messages")?.name ||
      "[Gmail]/All Mail";

    await moveMessageToMailbox({
      id,
      fromMailbox: mailboxName,
      toMailbox: allMailMailbox,
    });

    const session = await getSession();
    ensureDefaultSpace(session);
    session.spaceEmails ??= {};
    session.spaceEmails[spaceId] ??= {
      INBOX: [],
      SENT: [],
      DRAFTS: [],
      "[Gmail]/Spam": [],
      "[Gmail]/Trash": [],
    };

    const folders = session.spaceEmails[spaceId];
    for (const key of Object.keys(folders)) {
      folders[key] = (folders[key] || []).filter((x) => x !== id);
    }

    await session.save();

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Archivage impossible";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
