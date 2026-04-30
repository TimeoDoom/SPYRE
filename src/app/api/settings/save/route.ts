import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { readMailSettings, writeMailSettings } from "@/lib/persist";

export const runtime = "nodejs";

const noCrlf = (v: string) => !v.includes("\n") && !v.includes("\r");

const SettingsSchema = z.object({
  address: z.string().email().max(320).refine(noCrlf, "Invalid header"),
  appPassword: z
    .string()
    .max(200)
    .refine(noCrlf, "Invalid header")
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length ? v : undefined)),

  imapHost: z
    .string()
    .max(255)
    .refine(noCrlf, "Invalid header")
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length ? v : undefined)),
  imapPort: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length ? Number(v) : undefined))
    .refine((n) => n == null || (Number.isFinite(n) && n > 0), "Invalid port"),
  imapSecure: z.boolean(),

  smtpHost: z
    .string()
    .max(255)
    .refine(noCrlf, "Invalid header")
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length ? v : undefined)),
  smtpPort: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length ? Number(v) : undefined))
    .refine((n) => n == null || (Number.isFinite(n) && n > 0), "Invalid port"),
  smtpSecure: z.boolean(),
});

function checked(form: FormData, name: string) {
  return form.get(name) != null;
}

function getStr(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
}

function isTrustedPost(req: Request) {
  const reqUrl = new URL(req.url);

  // Helper: determine the apparent origin of the incoming request.
  const getRequestOrigin = () => {
    // Browser-sent Origin header takes precedence
    const origin = req.headers.get("origin");
    if (origin) return origin;

    // If behind a proxy (Render), the original protocol/host may be forwarded
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    if (xfProto && xfHost) return `${xfProto}://${xfHost}`;

    // Fallback to Referer header
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        return new URL(referer).origin;
      } catch {
        /* ignore */
      }
    }

    return null;
  };

  const requestOrigin = getRequestOrigin();

  // If we were able to infer an origin, accept when it equals the request URL origin
  // or the configured APP_BASE_URL (useful when behind a proxy/Load Balancer).
  if (requestOrigin) {
    if (requestOrigin === reqUrl.origin) return true;
    const appBase = process.env.APP_BASE_URL;
    if (appBase && requestOrigin === appBase) return true;
  }

  // As a last resort, fall back to sec-fetch-site check
  const secFetchSite = req.headers.get("sec-fetch-site");
  return secFetchSite === "same-origin" || secFetchSite === "same-site";
}

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);

  if (!isTrustedPost(req)) {
    const base = process.env.APP_BASE_URL ?? reqUrl.origin;
    const url = new URL("/settings", base);
    url.searchParams.set("error", "CSRF blocked");
    return NextResponse.redirect(url, 303);
  }

  const form = await req.formData();
  const parsed = SettingsSchema.safeParse({
    address: getStr(form, "address"),
    appPassword: getStr(form, "appPassword"),
    imapHost: getStr(form, "imapHost"),
    imapPort: getStr(form, "imapPort"),
    imapSecure: checked(form, "imapSecure"),
    smtpHost: getStr(form, "smtpHost"),
    smtpPort: getStr(form, "smtpPort"),
    smtpSecure: checked(form, "smtpSecure"),
  });

  if (!parsed.success) {
    const base = process.env.APP_BASE_URL ?? reqUrl.origin;
    const url = new URL("/settings", base);
    url.searchParams.set("error", "Formulaire invalide");
    return NextResponse.redirect(url, 303);
  }

  const session = await getSession();

  const existingPassword = (await readMailSettings(session))?.appPassword;
  const appPassword = parsed.data.appPassword ?? existingPassword;

  if (!appPassword) {
    const base = process.env.APP_BASE_URL ?? reqUrl.origin;
    const url = new URL("/settings", base);
    url.searchParams.set("error", "Mot de passe d’application requis");
    return NextResponse.redirect(url, 303);
  }

  await writeMailSettings(session, {
    address: parsed.data.address,
    appPassword,
    imapHost: parsed.data.imapHost,
    imapPort: parsed.data.imapPort,
    imapSecure: parsed.data.imapSecure,
    smtpHost: parsed.data.smtpHost,
    smtpPort: parsed.data.smtpPort,
    smtpSecure: parsed.data.smtpSecure,
  });

  const base = process.env.APP_BASE_URL ?? reqUrl.origin;
  return NextResponse.redirect(new URL("/settings?saved=1", base), 303);
}
