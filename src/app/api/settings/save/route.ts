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
  const reqUrl = new URL(req.url);

  if (!isTrustedPost(req)) {
    const url = new URL("/settings", reqUrl.origin);
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
    const url = new URL("/settings", reqUrl.origin);
    url.searchParams.set("error", "Formulaire invalide");
    return NextResponse.redirect(url, 303);
  }

  const session = await getSession();

  const existingPassword = (await readMailSettings(session))?.appPassword;
  const appPassword = parsed.data.appPassword ?? existingPassword;

  if (!appPassword) {
    const url = new URL("/settings", reqUrl.origin);
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

  return NextResponse.redirect(
    new URL("/settings?saved=1", reqUrl.origin),
    303,
  );
}
