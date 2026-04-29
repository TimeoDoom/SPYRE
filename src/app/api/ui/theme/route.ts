import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { readUiSettings, writeUiSettings } from "@/lib/persist";

export const runtime = "nodejs";

const ThemeSchema = z.object({
  theme: z.enum(["light", "dark"]),
  texture: z.enum(["none", "glass", "grain", "gradient"]).optional(),
});

const HexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/);

const BackgroundSchema = z.union([
  z.object({
    kind: z.literal("solid"),
    color: HexColor,
  }),
  z.object({
    kind: z.literal("gradient"),
    from: HexColor,
    to: HexColor,
    angle: z.number().min(0).max(360).optional(),
  }),
]);

const UiUpdateJsonSchema = z
  .object({
    theme: z.enum(["light", "dark"]).optional(),
    texture: z.enum(["none", "glass", "grain", "gradient"]).optional(),
    background: BackgroundSchema.optional().nullable(),
  })
  .refine((v) => v.theme || v.texture || v.background !== undefined, {
    message: "No updates provided",
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

function getStr(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
}

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);

  if (!isTrustedPost(req)) {
    const url = new URL("/settings", reqUrl.origin);
    url.searchParams.set("error", "CSRF blocked");
    return NextResponse.redirect(url, 303);
  }

  const contentType = req.headers.get("content-type") || "";

  // JSON path (used by in-app popups)
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = UiUpdateJsonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    const session = await getSession();
    await writeUiSettings(session, {
      theme: parsed.data.theme ?? session.ui?.theme,
      texture: parsed.data.texture ?? session.ui?.texture,
      background:
        parsed.data.background === null
          ? null
          : (parsed.data.background ?? session.ui?.background),
    });

    const ui = await readUiSettings(session);
    return NextResponse.json({ ok: true, ui });
  }

  // FormData path (Settings page)
  const form = await req.formData();
  const parsed = ThemeSchema.safeParse({
    theme: getStr(form, "theme"),
    texture: getStr(form, "texture"),
  });

  if (!parsed.success) {
    const url = new URL("/settings", reqUrl.origin);
    url.searchParams.set("error", "Formulaire invalide");
    return NextResponse.redirect(url, 303);
  }

  const session = await getSession();
  await writeUiSettings(session, {
    theme: parsed.data.theme,
    texture: parsed.data.texture ?? session.ui?.texture,
  });

  return NextResponse.redirect(
    new URL("/settings?saved=1", reqUrl.origin),
    303,
  );
}

export async function GET() {
  const session = await getSession();
  const ui = await readUiSettings(session);
  return NextResponse.json({ ok: true, ui: ui ?? {} });
}
