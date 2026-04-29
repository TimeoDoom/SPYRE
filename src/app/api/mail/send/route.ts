import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTextEmail } from "@/lib/gmail";

export const runtime = "nodejs";

const noCrlf = (v: string) => !v.includes("\n") && !v.includes("\r");

const SendJsonSchema = z.object({
  to: z.string().email().max(320).refine(noCrlf, "Invalid header"),
  cc: z
    .string()
    .max(2000)
    .refine(noCrlf, "Invalid header")
    .optional()
    .default(""),
  bcc: z
    .string()
    .max(2000)
    .refine(noCrlf, "Invalid header")
    .optional()
    .default(""),
  subject: z
    .string()
    .max(200)
    .refine(noCrlf, "Invalid header")
    .optional()
    .default(""),
  body: z.string().min(1).max(20000),
  bodyHtml: z.string().max(200000).optional(),
  inReplyTo: z.string().max(500).refine(noCrlf, "Invalid header").optional(),
  references: z
    .array(z.string().max(500).refine(noCrlf, "Invalid header"))
    .max(50)
    .optional(),
});

const SendFormSchema = z.object({
  to: z.string().email().max(320).refine(noCrlf, "Invalid header"),
  cc: z
    .string()
    .max(2000)
    .refine(noCrlf, "Invalid header")
    .optional()
    .default(""),
  bcc: z
    .string()
    .max(2000)
    .refine(noCrlf, "Invalid header")
    .optional()
    .default(""),
  subject: z
    .string()
    .max(200)
    .refine(noCrlf, "Invalid header")
    .optional()
    .default(""),
  body: z.string().max(20000).optional().default(""),
  bodyHtml: z.string().max(200000).optional(),
  inReplyTo: z.string().max(500).refine(noCrlf, "Invalid header").optional(),
  references: z
    .array(z.string().max(500).refine(noCrlf, "Invalid header"))
    .max(50)
    .optional(),
});

function getStr(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === "string" ? v : undefined;
}

function isTrustedPost(req: Request) {
  const reqUrl = new URL(req.url);

  const origin = req.headers.get("origin");
  if (origin) return origin === reqUrl.origin;

  // Some clients might omit Origin for same-site form POSTs. Fallback to Referer.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === reqUrl.origin;
    } catch {
      return false;
    }
  }

  // Last resort for modern browsers.
  const secFetchSite = req.headers.get("sec-fetch-site");
  return secFetchSite === "same-origin" || secFetchSite === "same-site";
}

function wantsJson(req: Request) {
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return accept.includes("application/json");
}

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);
  const json = wantsJson(req);

  if (!isTrustedPost(req)) {
    const url = new URL("/mail", reqUrl.origin);
    url.searchParams.set("compose", "1");
    url.searchParams.set("composeError", "CSRF blocked");
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "CSRF blocked" },
        { status: 403 },
      );
    }
    if (json) {
      return NextResponse.json(
        { ok: false, error: "CSRF blocked" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(url, 303);
  }

  const contentType = req.headers.get("content-type") || "";

  // JSON path (used by in-app compose modal)
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = SendJsonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Formulaire invalide" },
        { status: 400 },
      );
    }

    try {
      await sendTextEmail({
        to: parsed.data.to,
        cc: parsed.data.cc || undefined,
        bcc: parsed.data.bcc || undefined,
        subject: parsed.data.subject,
        body: parsed.data.body,
        bodyHtml: parsed.data.bodyHtml,
        inReplyTo: parsed.data.inReplyTo,
        references: parsed.data.references,
      });

      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Envoi impossible";
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  const form = await req.formData();
  const parsed = SendFormSchema.safeParse({
    to: getStr(form, "to"),
    cc: getStr(form, "cc"),
    bcc: getStr(form, "bcc"),
    subject: getStr(form, "subject"),
    body: getStr(form, "body"),
    bodyHtml: getStr(form, "bodyHtml"),
    inReplyTo: getStr(form, "inReplyTo"),
    references: form
      .getAll("references")
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean),
  });

  if (!parsed.success) {
    if (json) {
      return NextResponse.json(
        { ok: false, error: "Formulaire invalide" },
        { status: 400 },
      );
    }
    const url = new URL("/mail", reqUrl.origin);
    url.searchParams.set("compose", "1");
    url.searchParams.set("composeError", "Formulaire invalide");
    return NextResponse.redirect(url, 303);
  }

  try {
    const rawFiles = form.getAll("files");
    const files = rawFiles.filter((f): f is File => typeof f !== "string");

    if (!parsed.data.body.trim() && files.length === 0) {
      if (json) {
        return NextResponse.json(
          { ok: false, error: "Formulaire invalide" },
          { status: 400 },
        );
      }
      const url = new URL("/mail", reqUrl.origin);
      url.searchParams.set("compose", "1");
      url.searchParams.set("composeError", "Formulaire invalide");
      return NextResponse.redirect(url, 303);
    }

    const attachmentsRaw = await Promise.all(
      files.map(async (f) => {
        const ab = await f.arrayBuffer();
        const content = Buffer.from(ab);
        if (content.length === 0) return null;

        const name =
          typeof (f as any).name === "string"
            ? (f as any).name
            : "piece-jointe";
        const type = typeof (f as any).type === "string" ? (f as any).type : "";

        return {
          filename: name || "piece-jointe",
          content,
          ...(type ? { contentType: type } : {}),
        };
      }),
    );

    const attachments = attachmentsRaw.filter(
      (a): a is NonNullable<(typeof attachmentsRaw)[number]> => a !== null,
    );

    if (files.length > 0 && attachments.length === 0) {
      const msg =
        "Pièces jointes non lues (fichiers vides ou rejetés). Réessaie.";
      if (json) {
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }
      const url = new URL("/mail", reqUrl.origin);
      url.searchParams.set("compose", "1");
      url.searchParams.set("composeError", msg);
      return NextResponse.redirect(url, 303);
    }

    await sendTextEmail({
      to: parsed.data.to,
      cc: parsed.data.cc || undefined,
      bcc: parsed.data.bcc || undefined,
      subject: parsed.data.subject,
      body: parsed.data.body,
      bodyHtml: parsed.data.bodyHtml,
      inReplyTo: parsed.data.inReplyTo,
      references:
        parsed.data.references && parsed.data.references.length
          ? parsed.data.references
          : undefined,
      ...(attachments.length ? { attachments } : {}),
    });

    if (json)
      return NextResponse.json({
        ok: true,
        attachmentsCount: attachments.length,
      });
    const redirectUrl = new URL("/mail", reqUrl.origin);
    redirectUrl.searchParams.set("sent", "1");
    if (attachments.length) {
      redirectUrl.searchParams.set("attachments", String(attachments.length));
    }
    return NextResponse.redirect(redirectUrl, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Envoi impossible";
    if (json) {
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
    const url = new URL("/mail", reqUrl.origin);
    url.searchParams.set("compose", "1");
    url.searchParams.set("composeError", msg);
    return NextResponse.redirect(url, 303);
  }
}
