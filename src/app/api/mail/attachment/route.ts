import { NextResponse } from "next/server";
import { z } from "zod";
import { getMessageAttachment } from "@/lib/gmail";
import { getSession } from "@/lib/session";
import { readMailSettings } from "@/lib/persist";
import { readUiSettings } from "@/lib/persist";
import { normalizeAppLanguage, t } from "@/lib/i18n";

export const runtime = "nodejs";

const noCrlf = (v: string) => !v.includes("\n") && !v.includes("\r");

const QuerySchema = z.object({
  id: z.string().min(1).max(40),
  mailbox: z.string().max(200).refine(noCrlf, "Invalid mailbox").optional(),
  index: z.coerce.number().int().min(0).max(200),
});

function sanitizeFilename(name: string) {
  const trimmed = (name || "").trim() || "piece-jointe";
  // Remove dangerous characters for headers and paths.
  return trimmed
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\\/]/g, "-")
    .replace(/"/g, "'")
    .slice(0, 180);
}

function contentDispositionHeader(filename: string) {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(safe);
  // Provide both legacy and RFC5987.
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(req: Request) {
  const session = await getSession();
  const ui = await readUiSettings(session);
  const language = normalizeAppLanguage(ui.language);
  const mail = await readMailSettings(session);
  if (!mail?.address || !mail.appPassword) {
    return NextResponse.json(
      { ok: false, error: t(language, "mail.notConfigured") },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    id: url.searchParams.get("id"),
    mailbox: url.searchParams.get("mailbox") ?? undefined,
    index: url.searchParams.get("index"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Paramètres invalides" },
      { status: 400 },
    );
  }

  try {
    const att = await getMessageAttachment({
      id: parsed.data.id,
      mailboxName: parsed.data.mailbox,
      index: parsed.data.index,
    });

    const headers = new Headers();
    headers.set("Content-Type", att.contentType || "application/octet-stream");
    headers.set("Content-Disposition", contentDispositionHeader(att.filename));
    headers.set("Cache-Control", "private, max-age=0, must-revalidate");

    if (
      typeof att.size === "number" &&
      Number.isFinite(att.size) &&
      att.size > 0
    ) {
      headers.set("Content-Length", String(att.size));
    } else if (att.content?.length) {
      headers.set("Content-Length", String(att.content.length));
    }

    return new NextResponse(new Uint8Array(att.content), {
      status: 200,
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Téléchargement impossible";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
