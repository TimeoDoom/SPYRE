import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { normalizeAppLanguage } from "@/lib/i18n";
import { writeUiSettings } from "@/lib/persist";

const BodySchema = z.object({
  language: z.string().optional(),
});

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);
  const session = await getSession();

  let rawLanguage: unknown = undefined;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    rawLanguage = parsed.success ? parsed.data.language : undefined;
  } else {
    const form = await req.formData().catch(() => null);
    rawLanguage = form ? form.get("language") : undefined;
  }

  const language = normalizeAppLanguage(rawLanguage);
  await writeUiSettings(session, { language });

  return NextResponse.redirect(new URL("/settings?saved=1", reqUrl.origin));
}
