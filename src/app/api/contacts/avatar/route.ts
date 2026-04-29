import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ensureDbUser, upsertContactAvatar } from "@/lib/persist";

export const runtime = "nodejs";

const noCrlf = (v: string) => !v.includes("\n") && !v.includes("\r");

function isTrustedMutation(req: Request) {
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

const EmailSchema = z
  .string()
  .email()
  .max(320)
  .refine(noCrlf, "Invalid header")
  .transform((v) => v.trim().toLowerCase());

function isLikelySchemaOutOfDate(err: unknown): boolean {
  const msg = String((err as any)?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("unknown") ||
    msg.includes("invalid") ||
    msg.includes("column")
  );
}

function dbOutOfDateError() {
  return {
    ok: false,
    error:
      "Base de données pas à jour. Lance `npm run prisma:migrate:dev` (local) ou `npm run prisma:migrate:deploy` (prod).",
  } as const;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

function isAllowedImageType(type: string): boolean {
  const t = (type || "").trim().toLowerCase();
  return (
    t === "image/png" ||
    t === "image/jpeg" ||
    t === "image/webp" ||
    t === "image/gif"
  );
}

export async function GET(req: Request) {
  const session = await getSession();
  const url = new URL(req.url);
  const emailRaw = url.searchParams.get("email") ?? "";

  const parsed = EmailSchema.safeParse(emailRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Email invalide" },
      { status: 400 },
    );
  }

  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) {
    return NextResponse.json(
      { ok: false, error: "Persistence disabled" },
      { status: 400 },
    );
  }

  let contact: {
    avatarData: any;
    avatarContentType: string | null;
    avatarUpdatedAt: Date | null;
  } | null = null;
  try {
    contact = await prisma.contact.findUnique({
      where: { userId_email: { userId, email: parsed.data } },
      select: {
        avatarData: true,
        avatarContentType: true,
        avatarUpdatedAt: true,
      },
    });
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }

  if (!contact?.avatarData || !contact.avatarContentType) {
    return new Response("Not found", { status: 404 });
  }

  const body = new Blob([contact.avatarData], {
    type: contact.avatarContentType,
  });
  const headers = new Headers();
  headers.set("Content-Type", contact.avatarContentType);
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=3600");

  if (contact.avatarUpdatedAt) {
    headers.set("ETag", `W/\"${contact.avatarUpdatedAt.getTime()}\"`);
  }

  return new Response(body, { status: 200, headers });
}

export async function POST(req: Request) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json(
      { ok: false, error: "CSRF blocked" },
      { status: 403 },
    );
  }

  const session = await getSession();
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) {
    return NextResponse.json(
      { ok: false, error: "Persistence disabled" },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "Requête invalide" },
      { status: 400 },
    );
  }

  const emailRaw = form.get("email");
  const file = form.get("file");

  const emailParsed = EmailSchema.safeParse(emailRaw);
  if (!emailParsed.success) {
    return NextResponse.json(
      { ok: false, error: "Email invalide" },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Fichier manquant" },
      { status: 400 },
    );
  }

  const contentType = (file.type || "").trim();
  if (!isAllowedImageType(contentType)) {
    return NextResponse.json(
      { ok: false, error: "Type d’image non supporté (PNG/JPEG/WEBP/GIF)" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return NextResponse.json(
      { ok: false, error: "Fichier invalide" },
      { status: 400 },
    );
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Image trop lourde (max 2MB)" },
      { status: 400 },
    );
  }

  const ab = await file.arrayBuffer();
  const data = new Uint8Array(ab) as Uint8Array<ArrayBuffer>;

  try {
    await upsertContactAvatar(session, {
      email: emailParsed.data,
      data,
      contentType,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    const msg = typeof e?.message === "string" ? e.message : "Upload failed";
    if (msg === "Too many contacts") {
      return NextResponse.json(
        { ok: false, error: "Trop de contacts (limite 200)" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Upload impossible" },
      { status: 500 },
    );
  }
}
