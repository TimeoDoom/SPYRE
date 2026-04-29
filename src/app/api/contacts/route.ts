import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { deleteContact, readContacts, upsertContact } from "@/lib/persist";

export const runtime = "nodejs";

const noCrlf = (v: string) => !v.includes("\n") && !v.includes("\r");

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

const AddSchema = z.object({
  email: EmailSchema,
});

const RemoveSchema = z.object({
  email: EmailSchema,
});

const AvatarUrlSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const trimmed = v.trim();
    return trimmed ? trimmed : null;
  })
  .refine(
    (v) => {
      if (v === undefined || v === null) return true;
      if (!noCrlf(v)) return false;
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL invalide" },
  )
  .refine(
    (v) => v === undefined || v === null || v.length <= 2048,
    "URL invalide",
  );

const PatchSchema = z
  .object({
    email: EmailSchema,
    favorite: z.boolean().optional(),
    avatarUrl: AvatarUrlSchema,
  })
  .refine(
    (v) => v.favorite !== undefined || v.avatarUrl !== undefined,
    "Requête invalide",
  );

export async function GET() {
  const session = await getSession();
  try {
    const contacts = await readContacts(session);
    return NextResponse.json({ ok: true, contacts });
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      // Return 200 to avoid noisy console errors on auto-refreshing clients.
      return NextResponse.json(dbOutOfDateError());
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json(
      { ok: false, error: "CSRF blocked" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Email invalide" },
      { status: 400 },
    );
  }

  const session = await getSession();
  let existing: any[] = [];
  try {
    existing = await readContacts(session);
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
  if (existing.length >= 200) {
    return NextResponse.json(
      { ok: false, error: "Trop de contacts (limite 200)" },
      { status: 400 },
    );
  }

  try {
    const next = await upsertContact(session, {
      email: parsed.data.email,
      favorite: false,
    });
    return NextResponse.json({ ok: true, contacts: next });
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json(
      { ok: false, error: "CSRF blocked" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = RemoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Email invalide" },
      { status: 400 },
    );
  }

  const session = await getSession();
  try {
    const next = await deleteContact(session, parsed.data.email);
    return NextResponse.json({ ok: true, contacts: next });
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json(
      { ok: false, error: "CSRF blocked" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Requête invalide" },
      { status: 400 },
    );
  }

  const session = await getSession();
  let existing: any[] = [];
  try {
    existing = await readContacts(session);
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
  if (
    !existing.some((c) => c.email === parsed.data.email) &&
    existing.length >= 200
  ) {
    return NextResponse.json(
      { ok: false, error: "Trop de contacts (limite 200)" },
      { status: 400 },
    );
  }

  try {
    const next = await upsertContact(session, {
      email: parsed.data.email,
      ...(parsed.data.favorite !== undefined
        ? { favorite: parsed.data.favorite }
        : {}),
      ...(parsed.data.avatarUrl !== undefined
        ? { avatarUrl: parsed.data.avatarUrl }
        : {}),
    });
    return NextResponse.json({ ok: true, contacts: next });
  } catch (e) {
    if (isLikelySchemaOutOfDate(e)) {
      return NextResponse.json(dbOutOfDateError(), { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}
