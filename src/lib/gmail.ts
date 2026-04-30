import "server-only";

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { getSession } from "@/lib/session";
import { readMailSettings } from "@/lib/persist";
import { unstable_cache } from "next/cache";

// Simple in-memory cache for parsed messages (will be cleared on server restart)
const messageCache = new Map<string, any>();
const CACHE_MAX_SIZE = 100; // Keep last 100 messages
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour TTL

type MailEnv = {
  address: string;
  appPassword: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
};

function parseBool(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function parsePort(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function getMailEnv(): Promise<MailEnv> {
  const session = await getSession();
  const mail = await readMailSettings(session);

  if (mail?.address && mail.appPassword) {
    return {
      address: mail.address,
      appPassword: mail.appPassword,
      imap: {
        host: mail.imapHost ?? "imap.gmail.com",
        port: mail.imapPort ?? 993,
        secure: mail.imapSecure ?? true,
      },
      smtp: {
        host: mail.smtpHost ?? "smtp.gmail.com",
        port: mail.smtpPort ?? 465,
        secure: mail.smtpSecure ?? true,
      },
    };
  }

  // Backward compatibility: allow .env config if present.
  const address = process.env.GMAIL_ADDRESS;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!address || !appPassword) {
    throw new Error(
      "Compte non configuré. Ouvre /settings pour renseigner Gmail.",
    );
  }

  return {
    address,
    appPassword,
    imap: {
      host: process.env.IMAP_HOST ?? "imap.gmail.com",
      port: parsePort(process.env.IMAP_PORT, 993),
      secure: parseBool(process.env.IMAP_SECURE, true),
    },
    smtp: {
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: parsePort(process.env.SMTP_PORT, 465),
      secure: parseBool(process.env.SMTP_SECURE, true),
    },
  };
}

function formatAddress(addr?: { name?: string; address?: string } | null) {
  if (!addr?.address) return "";
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

function formatAddressList(
  list?: Array<{ name?: string; address?: string }> | null,
) {
  return (list ?? []).map(formatAddress).filter(Boolean).join(", ");
}

async function streamToBuffer(input: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input;
  if (!input || typeof input !== "object") return Buffer.from("");

  // imapflow provides Readable stream for `source`
  const stream = input as AsyncIterable<Uint8Array | Buffer | string>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function withImap<T>(fn: (client: ImapFlow) => Promise<T>) {
  const env = await getMailEnv();
  const client = new ImapFlow({
    host: env.imap.host,
    port: env.imap.port,
    secure: env.imap.secure,
    auth: {
      user: env.address,
      pass: env.appPassword,
    },
    logger: false,
  });

  try {
    await client.connect();
  } catch (connectErr) {
    const err = connectErr as any;
    const details = {
      host: env.imap.host,
      port: env.imap.port,
      secure: env.imap.secure,
      message: err?.message || String(err),
      code: err?.code || err?.statusCode,
    };
    console.error(
      "[withImap] Connection failed:",
      JSON.stringify(details, null, 2),
    );
    throw new Error(
      `Connexion IMAP échouée (${details.host}:${details.port}) - ${details.message}`,
    );
  }

  try {
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

export async function listMailbox(mailboxName: string, maxResults = 10) {
  return withImap(async (client) => {
    try {
      await client.mailboxOpen(mailboxName, { readOnly: true });
    } catch (err) {
      console.error(
        `[listMailbox] Failed to open mailbox "${mailboxName}":`,
        (err as any)?.message || String(err),
      );
      return [];
    }

    const mailbox = client.mailbox;
    if (!mailbox) {
      console.warn(
        `[listMailbox] Mailbox object is null after opening "${mailboxName}"`,
      );
      return [] as Array<{
        id: string;
        snippet: string;
        from: string;
        to: string;
        subject: string;
        date: string;
      }>;
    }

    const exists = mailbox.exists;
    if (!exists) {
      console.debug(
        `[listMailbox] Mailbox "${mailboxName}" exists=${exists}, returning empty`,
      );
      return [] as Array<{
        id: string;
        snippet: string;
        from: string;
        to: string;
        subject: string;
        date: string;
      }>;
    }

    const start = Math.max(1, exists - Math.max(1, maxResults) + 1);
    const range = `${start}:${exists}`;
    console.debug(
      `[listMailbox] Fetching range "${range}" from mailbox "${mailboxName}" (${exists} total messages)`,
    );

    const out: Array<{
      id: string;
      snippet: string;
      from: string;
      to: string;
      subject: string;
      date: string;
    }> = [];

    try {
      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        internalDate: true,
      })) {
        const env = msg.envelope;
        out.push({
          id: String(msg.uid),
          snippet: "",
          from: formatAddressList(env?.from as any),
          to: formatAddressList(env?.to as any),
          subject: env?.subject ?? "",
          date: (env?.date ?? msg.internalDate ?? new Date()).toLocaleString(),
        });
      }
    } catch (fetchErr) {
      console.error(
        `[listMailbox] Error fetching messages from "${mailboxName}":`,
        (fetchErr as any)?.message || String(fetchErr),
      );
      // Return what we got so far even if fetch failed
    }

    // newest first
    out.reverse();
    return out;
  });
}

export async function listMailboxThreads(mailboxName: string, maxResults = 50) {
  return withImap(async (client) => {
    try {
      await client.mailboxOpen(mailboxName, { readOnly: true });
    } catch (err) {
      console.error(
        `[listMailboxThreads] Failed to open mailbox "${mailboxName}":`,
        (err as any)?.message || String(err),
      );
      return [] as Array<{
        id: string;
        snippet: string;
        from: string;
        to: string;
        subject: string;
        date: string;
        threadCount?: number;
        threadHasReply?: boolean;
        threadUnreadCount?: number;
        threadMemberIds?: string[];
      }>;
    }

    const mailbox = client.mailbox as any;
    const exists = Number(mailbox?.exists ?? 0);
    if (!Number.isFinite(exists) || exists <= 0) return [];
    const want = Math.max(1, Math.floor(maxResults));
    // We fetch a little more than requested because grouping will reduce rows.
    const fetchCount = Math.min(250, Math.max(want * 4, want));
    const start = Math.max(1, exists - fetchCount + 1);
    const range = `${start}:${exists}`;

    type Row = {
      uid: number;
      threadId?: string;
      messageId: string;
      inReplyTo: string;
      from: string;
      to: string;
      subject: string;
      dateObj: Date;
      dateStr: string;
      seen: boolean;
    };

    const rows: Row[] = [];

    for await (const msg of client.fetch(range, {
      uid: true,
      envelope: true,
      internalDate: true,
      flags: true,
      threadId: true,
    })) {
      const env = msg.envelope as any;
      const internalDate = (msg as any).internalDate as Date | undefined;
      const dateObj: Date =
        (env?.date as Date | undefined) ?? internalDate ?? new Date();

      const flagsRaw = (msg as any).flags as unknown;
      const flags: string[] = (() => {
        if (Array.isArray(flagsRaw)) {
          return flagsRaw.filter((x) => typeof x === "string") as string[];
        }

        if (typeof flagsRaw === "string") return [flagsRaw];

        if (
          flagsRaw &&
          typeof flagsRaw === "object" &&
          typeof (flagsRaw as any)[Symbol.iterator] === "function"
        ) {
          return Array.from(flagsRaw as Iterable<unknown>).filter(
            (x): x is string => typeof x === "string",
          );
        }

        return [];
      })();

      const seen = flags.includes("\\Seen");

      const messageId = typeof env?.messageId === "string" ? env.messageId : "";
      const inReplyTo = typeof env?.inReplyTo === "string" ? env.inReplyTo : "";

      const threadIdRaw = (msg as any)?.threadId;
      const threadId =
        typeof threadIdRaw === "string" && threadIdRaw.trim()
          ? threadIdRaw.trim()
          : undefined;

      rows.push({
        uid: Number((msg as any).uid),
        threadId,
        messageId: messageId.trim(),
        inReplyTo: inReplyTo.trim(),
        from: formatAddressList(env?.from as any),
        to: formatAddressList(env?.to as any),
        subject: (env?.subject ?? "") as string,
        dateObj,
        dateStr: dateObj.toLocaleString(),
        seen,
      });
    }

    // Newest first within the raw list.
    rows.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    const byMessageId = new Map<string, Row>();
    for (const r of rows) {
      if (r.messageId) byMessageId.set(r.messageId, r);
    }

    const resolveRootKey = (r: Row): string => {
      // Prefer server-provided threadId when available (Gmail X-GM-THRID).
      if (r.threadId) return `thrid:${r.threadId}`;

      // Fallback: walk the inReplyTo chain within our fetched window.
      const visited = new Set<string>();
      let cur: Row | undefined = r;
      let guard = 0;
      while (cur?.inReplyTo && guard < 40) {
        const parentId = cur.inReplyTo;
        if (!parentId || visited.has(parentId)) break;
        visited.add(parentId);
        const parent = byMessageId.get(parentId);
        if (!parent) break;
        cur = parent;
        guard += 1;
      }
      return (
        (cur?.messageId || "").trim() ||
        (r.inReplyTo || "").trim() ||
        (r.messageId || "").trim() ||
        `uid:${r.uid}`
      );
    };

    type Group = {
      rootKey: string;
      latest: Row;
      memberIds: string[];
      unreadCount: number;
      hasReply: boolean;
    };

    const groups = new Map<string, Group>();
    for (const r of rows) {
      const rootKey = resolveRootKey(r);
      const existing = groups.get(rootKey);
      const unread = r.seen ? 0 : 1;
      const hasReply = Boolean(r.inReplyTo);

      if (!existing) {
        groups.set(rootKey, {
          rootKey,
          latest: r,
          memberIds: [String(r.uid)],
          unreadCount: unread,
          hasReply,
        });
        continue;
      }

      existing.memberIds.push(String(r.uid));
      existing.unreadCount += unread;
      existing.hasReply = existing.hasReply || hasReply;
      if (r.dateObj.getTime() > existing.latest.dateObj.getTime()) {
        existing.latest = r;
      }
    }

    const out = Array.from(groups.values())
      .sort((a, b) => b.latest.dateObj.getTime() - a.latest.dateObj.getTime())
      .slice(0, want)
      .map((g) => ({
        id: String(g.latest.uid),
        snippet: "",
        from: g.latest.from,
        to: g.latest.to,
        subject: g.latest.subject,
        date: g.latest.dateStr,
        threadCount: g.memberIds.length,
        threadHasReply: g.hasReply || g.memberIds.length > 1,
        threadUnreadCount: g.unreadCount,
        threadMemberIds: g.memberIds,
      }));

    return out;
  });
}

export async function listInbox(maxResults = 10) {
  return listMailbox("INBOX", maxResults);
}

export async function getMailboxes() {
  try {
    return await withImap(async (client) => {
      const mailboxes = await client.list();
      console.log(
        "[getMailboxes] Found mailboxes:",
        mailboxes.length,
        mailboxes.map((m: any) => m.path || m.name),
      );

      const categories: Array<{ name: string; label: string; icon: string }> =
        [];

      // Always include INBOX first
      categories.push({ name: "INBOX", label: "Inbox", icon: "📥" });

      for (const mb of mailboxes) {
        const name = (mb.path || mb.name || "").trim();
        if (!name || name === "INBOX") continue;

        let label = "";
        let icon = "📧";

        // Gmail labels/folders - support both English and localized (French) names
        if (name.includes("Spam") || name.includes("spam")) {
          label = "Spam";
          icon = "🚫";
        } else if (
          name.includes("Trash") ||
          name.includes("Corbeille") ||
          name.includes("trash")
        ) {
          label = "Corbeille";
          icon = "🗑️";
        } else if (
          name.includes("Sent") ||
          name.includes("envoy") ||
          name.includes("Messages envoyés") ||
          name.includes("sent")
        ) {
          label = "Envoyés";
          icon = "📤";
        } else if (
          name.includes("Drafts") ||
          name.includes("Brouillons") ||
          name.includes("drafts")
        ) {
          label = "Brouillons";
          icon = "✏️";
        } else if (
          name.includes("All Mail") ||
          name.includes("Tous les messages") ||
          name.includes("all mail")
        ) {
          label = "Tous les messages";
          icon = "📂";
        } else if (name.startsWith("[Gmail]")) {
          // Skip other Gmail system labels
          continue;
        } else if (name === "Plus tard") {
          // Skip custom labels for now
          continue;
        } else {
          // Skip other labels
          continue;
        }

        if (label && !categories.find((c) => c.label === label)) {
          categories.push({ name, label, icon });
        }
      }

      console.log("[getMailboxes] Returning categories:", categories);
      return categories;
    });
  } catch (err) {
    console.error("Error fetching mailboxes:", err);
    // Return only INBOX as fallback if something goes wrong
    return [{ name: "INBOX", label: "Inbox", icon: "📥" }];
  }
}

export async function getMessage(id: string, mailboxName = "INBOX") {
  const cacheKey = `${mailboxName}:${id}`;

  // Check in-memory cache first
  const cached = messageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.debug(`[getMessage] Cache HIT for ${cacheKey}`);
    return cached.data;
  }

  console.debug(`[getMessage] Cache MISS for ${cacheKey}, fetching...`);
  const result = await getMessageCore(id, mailboxName);

  // Store in cache
  messageCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  // Simple LRU: remove oldest if cache too large
  if (messageCache.size > CACHE_MAX_SIZE) {
    const firstKey = messageCache.keys().next().value;
    if (firstKey !== undefined) {
      messageCache.delete(firstKey);
    }
  }

  return result;
}

async function getMessageCore(id: string, mailboxName = "INBOX") {
  const uid = Number(id);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("Invalid message id");

  return withImap(async (client) => {
    await client.mailboxOpen(mailboxName, { readOnly: true });

    const msg = await client.fetchOne(
      String(uid),
      {
        envelope: true,
        internalDate: true,
        source: true,
      },
      { uid: true },
    );

    if (!msg) throw new Error("Message not found");

    const raw = await streamToBuffer(msg.source);
    const parsed = await simpleParser(raw);

    const parseMessageIdList = (rawValue: unknown): string[] => {
      if (!rawValue) return [];
      if (Array.isArray(rawValue)) {
        return rawValue
          .map((x) => (typeof x === "string" ? x : ""))
          .flatMap((s) => s.match(/<[^>]+>/g) ?? [])
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const str = typeof rawValue === "string" ? rawValue : String(rawValue);
      return (str.match(/<[^>]+>/g) ?? []).map((s) => s.trim()).filter(Boolean);
    };

    const messageId =
      typeof (parsed as any).messageId === "string"
        ? (parsed as any).messageId
        : typeof (parsed as any).messageID === "string"
          ? (parsed as any).messageID
          : "";
    const inReplyTo =
      typeof (parsed as any).inReplyTo === "string"
        ? (parsed as any).inReplyTo
        : "";
    const refs = Array.isArray((parsed as any).references)
      ? ((parsed as any).references as unknown[])
          .filter((x) => typeof x === "string")
          .flatMap((x) => parseMessageIdList(x))
      : parseMessageIdList((parsed as any).headers?.get?.("references"));

    const threadId = (refs[0] || inReplyTo || messageId || String(uid)).trim();

    const addressText = (v: unknown) => {
      if (!v) return "";
      if (Array.isArray(v)) {
        return v
          .map((x) => (x && typeof x === "object" ? (x as any).text : ""))
          .filter(Boolean)
          .join(", ");
      }
      return typeof v === "object" ? ((v as any).text ?? "") : "";
    };

    const dateObj: Date =
      (parsed.date as any) ??
      (msg.envelope?.date as any) ??
      (msg.internalDate as any) ??
      new Date();

    const senderEmail = (() => {
      const v = (parsed.from as any)?.value;
      if (Array.isArray(v) && v[0] && typeof v[0].address === "string") {
        return String(v[0].address).trim().toLowerCase();
      }
      const t = addressText(parsed.from) || "";
      const m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return (m?.[0] || "").trim().toLowerCase();
    })();

    const bodyText = parsed.text ?? "";

    const attachments = Array.isArray((parsed as any).attachments)
      ? ((parsed as any).attachments as any[])
          .map((a, index) => {
            const filename = typeof a?.filename === "string" ? a.filename : "";
            const contentType =
              typeof a?.contentType === "string" ? a.contentType : "";
            const size = Number.isFinite(a?.size) ? Number(a.size) : 0;
            const disposition =
              typeof a?.contentDisposition === "string"
                ? a.contentDisposition
                : typeof a?.contentDisposition === "object" &&
                    typeof a?.contentDisposition?.type === "string"
                  ? a.contentDisposition.type
                  : undefined;
            const contentId =
              typeof a?.contentId === "string"
                ? a.contentId
                : typeof a?.cid === "string"
                  ? a.cid
                  : undefined;

            return {
              index,
              filename: filename || "piece-jointe",
              contentType,
              size,
              disposition,
              contentId,
            };
          })
          .filter((a) => Boolean(a.filename) && a.size >= 0)
      : [];

    let bodyHtml = parsed.html
      ? sanitizeHtml(parsed.html, {
          allowedTags: [
            "b",
            "i",
            "em",
            "strong",
            "a",
            "p",
            "br",
            "ul",
            "ol",
            "li",
            "blockquote",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "img",
            "table",
            "thead",
            "tbody",
            "tfoot",
            "tr",
            "th",
            "td",
            "div",
            "span",
            "pre",
            "code",
            "hr",
          ],
          allowedAttributes: {
            "*": ["style"],
            a: ["href", "title", "target"],
            img: ["src", "alt", "title", "width", "height", "style"],
            blockquote: ["cite"],
            table: [
              "border",
              "bordercolor",
              "cellpadding",
              "cellspacing",
              "width",
              "height",
              "align",
              "bgcolor",
              "style",
            ],
            thead: ["style"],
            tbody: ["style"],
            tfoot: ["style"],
            tr: ["style", "align", "valign", "bgcolor"],
            td: [
              "colspan",
              "rowspan",
              "width",
              "height",
              "align",
              "valign",
              "bgcolor",
              "style",
            ],
            th: [
              "colspan",
              "rowspan",
              "width",
              "height",
              "align",
              "valign",
              "bgcolor",
              "style",
            ],
            div: ["style"],
            span: ["style"],
            p: ["style"],
          },
          allowedSchemes: ["http", "https", "mailto", "tel", "ftp"],
          allowedStyles: {
            "*": {
              color: [/.*/],
              "background-color": [/.*/],
              "max-width": [/.*/],
              width: [/.*/],
              height: [/.*/],
              "text-align": [/.*/],
              "vertical-align": [/.*/],
              "font-size": [/.*/],
              "font-weight": [/.*/],
              "font-style": [/.*/],
              "text-decoration": [/.*/],
              "line-height": [/.*/],
              "font-family": [/.*/],
              display: [/.*/],
              padding: [/.*/],
              "padding-left": [/.*/],
              "padding-right": [/.*/],
              "padding-top": [/.*/],
              "padding-bottom": [/.*/],
              margin: [/.*/],
              "margin-left": [/.*/],
              "margin-right": [/.*/],
              "margin-top": [/.*/],
              "margin-bottom": [/.*/],
              border: [/.*/],
              "border-color": [/.*/],
              "border-width": [/.*/],
              "border-style": [/.*/],
              "border-collapse": [/.*/],
              "border-radius": [/.*/],
            },
          },
          transformTags: {
            a: (tagName, attribs) => {
              return {
                tagName,
                attribs: {
                  ...attribs,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
              };
            },
          },
        })
      : "";

    if (!bodyHtml && bodyText) {
      bodyHtml = bodyText
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return "<br />";
          const escaped = trimmed
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
          return `<p>${escaped}</p>`;
        })
        .join("");
    }

    return {
      id: String(uid),
      mailbox: mailboxName,
      threadId,
      messageId,
      inReplyTo,
      references: refs,
      senderEmail,
      from:
        addressText(parsed.from) ||
        formatAddressList((msg.envelope as any)?.from),
      to:
        addressText(parsed.to) || formatAddressList((msg.envelope as any)?.to),
      cc:
        addressText((parsed as any).cc) ||
        formatAddressList((msg.envelope as any)?.cc),
      subject: parsed.subject ?? msg.envelope?.subject ?? "",
      dateIso: dateObj instanceof Date ? dateObj.toISOString() : undefined,
      date: (dateObj instanceof Date ? dateObj : new Date()).toLocaleString(),
      snippet: (parsed.text ?? "").slice(0, 200),
      bodyText: bodyText || "(pas de contenu texte)",
      bodyHtml,
      attachments,
    };
  });
}

export async function getThreadMessages(
  id: string,
  mailboxName = "INBOX",
  options?: { maxMessages?: number },
) {
  const uid = Number(id);
  if (!Number.isFinite(uid) || uid <= 0) {
    console.warn(`[getThreadMessages] Ignoring invalid message id: "${id}"`);
    return [];
  }
  const maxMessages =
    typeof options?.maxMessages === "number" && options.maxMessages > 0
      ? Math.min(50, Math.max(1, Math.floor(options.maxMessages)))
      : 50;

  try {
    return await withImap(async (client) => {
      await client.mailboxOpen(mailboxName, { readOnly: true });

      const seed = await client.fetchOne(
        String(uid),
        { envelope: true, internalDate: true, source: true, threadId: true },
        { uid: true },
      );
      if (!seed) throw new Error("Message not found");

      const seedThreadIdRaw = (seed as any)?.threadId;
      const seedThreadId =
        typeof seedThreadIdRaw === "string" && seedThreadIdRaw.trim()
          ? seedThreadIdRaw.trim()
          : "";

      const rawSeed = await streamToBuffer(seed.source);
      const parsedSeed = await simpleParser(rawSeed);

      const parseMessageIdList = (rawValue: unknown): string[] => {
        if (!rawValue) return [];
        if (Array.isArray(rawValue)) {
          return rawValue
            .map((x) => (typeof x === "string" ? x : ""))
            .flatMap((s) => s.match(/<[^>]+>/g) ?? [])
            .map((s) => s.trim())
            .filter(Boolean);
        }
        const str = typeof rawValue === "string" ? rawValue : String(rawValue);
        return (str.match(/<[^>]+>/g) ?? [])
          .map((s) => s.trim())
          .filter(Boolean);
      };

      const seedMessageId =
        typeof (parsedSeed as any).messageId === "string"
          ? (parsedSeed as any).messageId
          : typeof (parsedSeed as any).messageID === "string"
            ? (parsedSeed as any).messageID
            : "";
      const seedInReplyTo =
        typeof (parsedSeed as any).inReplyTo === "string"
          ? (parsedSeed as any).inReplyTo
          : "";
      const seedRefs = Array.isArray((parsedSeed as any).references)
        ? ((parsedSeed as any).references as unknown[])
            .filter((x) => typeof x === "string")
            .flatMap((x) => parseMessageIdList(x))
        : parseMessageIdList((parsedSeed as any).headers?.get?.("references"));

      // Gmail threads span multiple folders (inbox + sent). Use "All Mail" when available.
      // Note: the exact mailbox name can be localized.
      let threadMailboxName = mailboxName;
      for (const candidate of [
        "[Gmail]/All Mail",
        "[Gmail]/Tous les messages",
      ]) {
        try {
          await client.mailboxOpen(candidate, { readOnly: true });
          threadMailboxName = candidate;
          break;
        } catch {
          // keep trying
        }
      }

      // Prefer server-provided thread id when available (OBJECTID THREADID or Gmail X-GM-THRID).
      // This is the most reliable way to get the full conversation, including Sent items.
      if (seedThreadId) {
        try {
          const addressText = (v: unknown) => {
            if (!v) return "";
            if (Array.isArray(v)) {
              return v
                .map((x) => (x && typeof x === "object" ? (x as any).text : ""))
                .filter(Boolean)
                .join(", ");
            }
            return typeof v === "object" ? ((v as any).text ?? "") : "";
          };

          const parseFetched = async (msg: any, sourceMailbox: string) => {
            try {
              const raw = await streamToBuffer(msg.source);
              const parsed = await simpleParser(raw);

              const bodyText = (parsed.text ?? "") as string;
              const attachments = Array.isArray((parsed as any).attachments)
                ? ((parsed as any).attachments as any[])
                    .map((a, index) => {
                      const filename =
                        typeof a?.filename === "string" ? a.filename : "";
                      const contentType =
                        typeof a?.contentType === "string" ? a.contentType : "";
                      const size = Number.isFinite(a?.size)
                        ? Number(a.size)
                        : 0;
                      const disposition =
                        typeof a?.contentDisposition === "string"
                          ? a.contentDisposition
                          : typeof a?.contentDisposition === "object" &&
                              typeof a?.contentDisposition?.type === "string"
                            ? a.contentDisposition.type
                            : undefined;
                      const contentId =
                        typeof a?.contentId === "string"
                          ? a.contentId
                          : typeof a?.cid === "string"
                            ? a.cid
                            : undefined;

                      return {
                        index,
                        filename: filename || "piece-jointe",
                        contentType,
                        size,
                        disposition,
                        contentId,
                      };
                    })
                    .filter((a) => Boolean(a.filename) && a.size >= 0)
                : [];

              let bodyHtml = parsed.html
                ? sanitizeHtml(parsed.html, {
                    allowedTags: [
                      "b",
                      "i",
                      "em",
                      "strong",
                      "a",
                      "p",
                      "br",
                      "ul",
                      "ol",
                      "li",
                      "blockquote",
                      "h1",
                      "h2",
                      "h3",
                      "h4",
                      "h5",
                      "h6",
                      "img",
                      "table",
                      "thead",
                      "tbody",
                      "tfoot",
                      "tr",
                      "th",
                      "td",
                      "div",
                      "span",
                      "pre",
                      "code",
                      "hr",
                    ],
                    allowedAttributes: {
                      "*": ["style"],
                      a: ["href", "title", "target"],
                      img: ["src", "alt", "title", "width", "height", "style"],
                      blockquote: ["cite"],
                      table: [
                        "border",
                        "bordercolor",
                        "cellpadding",
                        "cellspacing",
                        "width",
                        "height",
                        "align",
                        "bgcolor",
                        "style",
                      ],
                      thead: ["style"],
                      tbody: ["style"],
                      tfoot: ["style"],
                      tr: ["style", "align", "valign", "bgcolor"],
                      td: [
                        "colspan",
                        "rowspan",
                        "width",
                        "height",
                        "align",
                        "valign",
                        "bgcolor",
                        "style",
                      ],
                      th: [
                        "colspan",
                        "rowspan",
                        "width",
                        "height",
                        "align",
                        "valign",
                        "bgcolor",
                        "style",
                      ],
                      div: ["style"],
                      span: ["style"],
                      p: ["style"],
                    },
                    allowedSchemes: ["http", "https", "mailto", "tel", "ftp"],
                    allowedStyles: {
                      "*": {
                        color: [/.*/],
                        "background-color": [/.*/],
                        "max-width": [/.*/],
                        width: [/.*/],
                        height: [/.*/],
                        "text-align": [/.*/],
                        "vertical-align": [/.*/],
                        "font-size": [/.*/],
                        "font-weight": [/.*/],
                        "font-style": [/.*/],
                        "text-decoration": [/.*/],
                        "line-height": [/.*/],
                        "font-family": [/.*/],
                        display: [/.*/],
                        padding: [/.*/],
                        "padding-left": [/.*/],
                        "padding-right": [/.*/],
                        "padding-top": [/.*/],
                        "padding-bottom": [/.*/],
                        margin: [/.*/],
                        "margin-left": [/.*/],
                        "margin-right": [/.*/],
                        "margin-top": [/.*/],
                        "margin-bottom": [/.*/],
                        border: [/.*/],
                        "border-color": [/.*/],
                        "border-width": [/.*/],
                        "border-style": [/.*/],
                        "border-collapse": [/.*/],
                        "border-radius": [/.*/],
                      },
                    },
                    transformTags: {
                      a: (tagName, attribs) => {
                        return {
                          tagName,
                          attribs: {
                            ...attribs,
                            target: "_blank",
                            rel: "noopener noreferrer",
                          },
                        };
                      },
                    },
                  })
                : "";

              if (!bodyHtml && bodyText) {
                bodyHtml = bodyText
                  .split("\n")
                  .map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed) return "<br />";
                    const escaped = trimmed
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/\"/g, "&quot;")
                      .replace(/'/g, "&#039;");
                    return `<p>${escaped}</p>`;
                  })
                  .join("");
              }

              const msgId =
                typeof (parsed as any).messageId === "string"
                  ? (parsed as any).messageId
                  : typeof (parsed as any).messageID === "string"
                    ? (parsed as any).messageID
                    : "";
              const inReplyTo =
                typeof (parsed as any).inReplyTo === "string"
                  ? (parsed as any).inReplyTo
                  : "";
              const refs = Array.isArray((parsed as any).references)
                ? ((parsed as any).references as unknown[])
                    .filter((x) => typeof x === "string")
                    .flatMap((x) => parseMessageIdList(x))
                : parseMessageIdList(
                    (parsed as any).headers?.get?.("references"),
                  );

              const threadId = (
                refs[0] ||
                inReplyTo ||
                msgId ||
                String(msg.uid)
              ).trim();

              const dateObj: Date =
                (parsed.date as any) ??
                (msg.envelope?.date as any) ??
                (msg.internalDate as any) ??
                new Date();

              const senderEmail = (() => {
                const v = (parsed.from as any)?.value;
                if (
                  Array.isArray(v) &&
                  v[0] &&
                  typeof v[0].address === "string"
                ) {
                  return String(v[0].address).trim().toLowerCase();
                }
                const t = addressText(parsed.from) || "";
                const m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
                return (m?.[0] || "").trim().toLowerCase();
              })();

              return {
                id: String(msg.uid),
                mailbox: sourceMailbox,
                threadId,
                messageId: msgId,
                inReplyTo,
                references: refs,
                senderEmail,
                from:
                  addressText(parsed.from) ||
                  formatAddressList((msg.envelope as any)?.from),
                to:
                  addressText(parsed.to) ||
                  formatAddressList((msg.envelope as any)?.to),
                cc:
                  addressText((parsed as any).cc) ||
                  formatAddressList((msg.envelope as any)?.cc),
                subject: parsed.subject ?? msg.envelope?.subject ?? "",
                dateIso:
                  dateObj instanceof Date ? dateObj.toISOString() : undefined,
                date: (dateObj instanceof Date
                  ? dateObj
                  : new Date()
                ).toLocaleString(),
                snippet: (parsed.text ?? "").slice(0, 200),
                bodyText: bodyText || "(pas de contenu texte)",
                bodyHtml,
                attachments,
              };
            } catch {
              return null;
            }
          };

          const mailboxesToSearch: string[] = [];
          const pushUniqueMailbox = (mb: string) => {
            const v = (mb || "").trim();
            if (!v) return;
            if (!mailboxesToSearch.includes(v)) mailboxesToSearch.push(v);
          };

          pushUniqueMailbox(threadMailboxName);
          pushUniqueMailbox(mailboxName);
          for (const candidate of [
            "[Gmail]/Sent Mail",
            "[Gmail]/Messages envoyés",
            "[Gmail]/Envoyés",
          ]) {
            pushUniqueMailbox(candidate);
          }

          const out: any[] = [];
          const seenStable = new Set<string>();

          for (const mb of mailboxesToSearch) {
            try {
              await client.mailboxOpen(mb, { readOnly: true });
            } catch {
              continue;
            }

            let found: any;
            try {
              found = await client.search(
                { threadId: seedThreadId } as any,
                { uid: true } as any,
              );
            } catch {
              continue;
            }

            const uids = Array.isArray(found)
              ? found
                  .map((n) => Number(n))
                  .filter((n) => Number.isFinite(n) && n > 0)
              : [];
            if (!uids.length) continue;

            for await (const msg of client.fetch(
              uids,
              { envelope: true, internalDate: true, source: true },
              { uid: true },
            )) {
              const stable =
                (typeof (msg as any).emailId === "string" &&
                  (msg as any).emailId) ||
                `${mb}:${String((msg as any).uid)}`;
              if (seenStable.has(stable)) continue;
              const parsed = await parseFetched(msg as any, mb);
              if (!parsed) continue;
              seenStable.add(stable);
              out.push(parsed);
            }
          }

          if (out.length) {
            out.sort((a, b) => {
              const ta = Date.parse(a.dateIso || a.date || "") || 0;
              const tb = Date.parse(b.dateIso || b.date || "") || 0;
              return ta - tb;
            });

            const trimmed =
              out.length > maxMessages
                ? out.slice(out.length - maxMessages)
                : out;
            return trimmed;
          }
        } catch {
          // fall back to header-based heuristic below
        }
      }

      const tryResolveRootFromParent = async (): Promise<string> => {
        const base = (seedInReplyTo || seedMessageId || "").trim();
        if (!base) return "";
        try {
          // Search parent by Message-Id in the broadest mailbox.
          if (threadMailboxName !== mailboxName) {
            await client.mailboxOpen(threadMailboxName, { readOnly: true });
          }
          const found = await client.search(
            {
              header: ["message-id", base],
            } as any,
            { uid: true } as any,
          );
          const parentUid =
            Array.isArray(found) && found.length ? Number(found[0]) : NaN;
          if (!Number.isFinite(parentUid) || parentUid <= 0) return "";

          const parent = await client.fetchOne(
            String(parentUid),
            { source: true },
            { uid: true },
          );
          if (!parent) return "";
          const rawParent = await streamToBuffer((parent as any).source);
          const parsedParent = await simpleParser(rawParent);

          const parentMessageId =
            typeof (parsedParent as any).messageId === "string"
              ? (parsedParent as any).messageId
              : typeof (parsedParent as any).messageID === "string"
                ? (parsedParent as any).messageID
                : "";
          const parentInReplyTo =
            typeof (parsedParent as any).inReplyTo === "string"
              ? (parsedParent as any).inReplyTo
              : "";
          const parentRefs = Array.isArray((parsedParent as any).references)
            ? ((parsedParent as any).references as unknown[])
                .filter((x) => typeof x === "string")
                .flatMap((x) => parseMessageIdList(x))
            : parseMessageIdList(
                (parsedParent as any).headers?.get?.("references"),
              );

          return (
            parentRefs[0] ||
            parentInReplyTo ||
            parentMessageId ||
            ""
          ).trim();
        } catch {
          return "";
        }
      };

      const rootId = (() => {
        const candidate = (seedRefs[0] || "").trim();
        return candidate;
      })();

      const resolvedRootId = rootId || (await tryResolveRootFromParent());
      const finalRootId = (
        resolvedRootId ||
        seedInReplyTo ||
        seedMessageId ||
        ""
      ).trim();

      if (!finalRootId) {
        const single = await getMessage(String(uid), mailboxName);
        return [single];
      }

      const uids = new Set<number>(
        threadMailboxName === mailboxName ? [uid] : [],
      );

      // Ensure searches happen in the broad mailbox when available.
      if (threadMailboxName !== mailboxName) {
        try {
          await client.mailboxOpen(threadMailboxName, { readOnly: true });
        } catch {
          // ignore
        }
      }

      const tryHeaderSearch = async (headerName: string) => {
        try {
          const found = await client.search(
            {
              header: [headerName, finalRootId],
            } as any,
            { uid: true } as any,
          );
          if (Array.isArray(found)) {
            for (const n of found) uids.add(Number(n));
          }
        } catch {
          // ignore
        }
      };

      await tryHeaderSearch("references");
      await tryHeaderSearch("in-reply-to");
      await tryHeaderSearch("message-id");

      const list = Array.from(uids).filter((n) => Number.isFinite(n) && n > 0);
      if (!list.length) {
        const single = await getMessage(String(uid), mailboxName);
        return [single];
      }

      const out: any[] = [];
      for await (const msg of client.fetch(
        list,
        { envelope: true, internalDate: true, source: true },
        { uid: true },
      )) {
        try {
          const raw = await streamToBuffer((msg as any).source);
          const parsed = await simpleParser(raw);

          const addressText = (v: unknown) => {
            if (!v) return "";
            if (Array.isArray(v)) {
              return v
                .map((x) => (x && typeof x === "object" ? (x as any).text : ""))
                .filter(Boolean)
                .join(", ");
            }
            return typeof v === "object" ? ((v as any).text ?? "") : "";
          };

          const bodyText = (parsed.text ?? "") as string;
          const attachments = Array.isArray((parsed as any).attachments)
            ? ((parsed as any).attachments as any[])
                .map((a, index) => {
                  const filename =
                    typeof a?.filename === "string" ? a.filename : "";
                  const contentType =
                    typeof a?.contentType === "string" ? a.contentType : "";
                  const size = Number.isFinite(a?.size) ? Number(a.size) : 0;
                  const disposition =
                    typeof a?.contentDisposition === "string"
                      ? a.contentDisposition
                      : typeof a?.contentDisposition === "object" &&
                          typeof a?.contentDisposition?.type === "string"
                        ? a.contentDisposition.type
                        : undefined;
                  const contentId =
                    typeof a?.contentId === "string"
                      ? a.contentId
                      : typeof a?.cid === "string"
                        ? a.cid
                        : undefined;

                  return {
                    index,
                    filename: filename || "piece-jointe",
                    contentType,
                    size,
                    disposition,
                    contentId,
                  };
                })
                .filter((a) => Boolean(a.filename) && a.size >= 0)
            : [];

          let bodyHtml = parsed.html
            ? sanitizeHtml(parsed.html, {
                allowedTags: [
                  "b",
                  "i",
                  "em",
                  "strong",
                  "a",
                  "p",
                  "br",
                  "ul",
                  "ol",
                  "li",
                  "blockquote",
                  "h1",
                  "h2",
                  "h3",
                  "h4",
                  "h5",
                  "h6",
                  "img",
                  "table",
                  "thead",
                  "tbody",
                  "tfoot",
                  "tr",
                  "th",
                  "td",
                  "div",
                  "span",
                  "pre",
                  "code",
                  "hr",
                ],
                allowedAttributes: {
                  "*": ["style"],
                  a: ["href", "title", "target"],
                  img: ["src", "alt", "title", "width", "height", "style"],
                  blockquote: ["cite"],
                  table: [
                    "border",
                    "bordercolor",
                    "cellpadding",
                    "cellspacing",
                    "width",
                    "height",
                    "align",
                    "bgcolor",
                    "style",
                  ],
                  thead: ["style"],
                  tbody: ["style"],
                  tfoot: ["style"],
                  tr: ["style", "align", "valign", "bgcolor"],
                  td: [
                    "colspan",
                    "rowspan",
                    "width",
                    "height",
                    "align",
                    "valign",
                    "bgcolor",
                    "style",
                  ],
                  th: [
                    "colspan",
                    "rowspan",
                    "width",
                    "height",
                    "align",
                    "valign",
                    "bgcolor",
                    "style",
                  ],
                  div: ["style"],
                  span: ["style"],
                  p: ["style"],
                },
                allowedSchemes: ["http", "https", "mailto", "tel", "ftp"],
                allowedStyles: {
                  "*": {
                    color: [/.*/],
                    "background-color": [/.*/],
                    "max-width": [/.*/],
                    width: [/.*/],
                    height: [/.*/],
                    "text-align": [/.*/],
                    "vertical-align": [/.*/],
                    "font-size": [/.*/],
                    "font-weight": [/.*/],
                    "font-style": [/.*/],
                    "text-decoration": [/.*/],
                    "line-height": [/.*/],
                    "font-family": [/.*/],
                    display: [/.*/],
                    padding: [/.*/],
                    "padding-left": [/.*/],
                    "padding-right": [/.*/],
                    "padding-top": [/.*/],
                    "padding-bottom": [/.*/],
                    margin: [/.*/],
                    "margin-left": [/.*/],
                    "margin-right": [/.*/],
                    "margin-top": [/.*/],
                    "margin-bottom": [/.*/],
                    border: [/.*/],
                    "border-color": [/.*/],
                    "border-width": [/.*/],
                    "border-style": [/.*/],
                    "border-collapse": [/.*/],
                    "border-radius": [/.*/],
                  },
                },
                transformTags: {
                  a: (tagName, attribs) => {
                    return {
                      tagName,
                      attribs: {
                        ...attribs,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                    };
                  },
                },
              })
            : "";

          if (!bodyHtml && bodyText) {
            bodyHtml = bodyText
              .split("\n")
              .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return "<br />";
                const escaped = trimmed
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/\"/g, "&quot;")
                  .replace(/'/g, "&#039;");
                return `<p>${escaped}</p>`;
              })
              .join("");
          }

          const msgId =
            typeof (parsed as any).messageId === "string"
              ? (parsed as any).messageId
              : typeof (parsed as any).messageID === "string"
                ? (parsed as any).messageID
                : "";
          const inReplyTo =
            typeof (parsed as any).inReplyTo === "string"
              ? (parsed as any).inReplyTo
              : "";
          const refs = Array.isArray((parsed as any).references)
            ? ((parsed as any).references as unknown[])
                .filter((x) => typeof x === "string")
                .flatMap((x) => parseMessageIdList(x))
            : parseMessageIdList((parsed as any).headers?.get?.("references"));

          const threadId = (
            refs[0] ||
            inReplyTo ||
            msgId ||
            String((msg as any).uid)
          ).trim();

          const dateObj: Date =
            (parsed.date as any) ??
            ((msg as any).envelope?.date as any) ??
            ((msg as any).internalDate as any) ??
            new Date();

          const senderEmail = (() => {
            const v = (parsed.from as any)?.value;
            if (Array.isArray(v) && v[0] && typeof v[0].address === "string") {
              return String(v[0].address).trim().toLowerCase();
            }
            const t = addressText(parsed.from) || "";
            const m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
            return (m?.[0] || "").trim().toLowerCase();
          })();

          out.push({
            id: String((msg as any).uid),
            mailbox: threadMailboxName,
            threadId,
            messageId: msgId,
            inReplyTo,
            references: refs,
            senderEmail,
            from:
              addressText(parsed.from) ||
              formatAddressList(((msg as any).envelope as any)?.from),
            to:
              addressText(parsed.to) ||
              formatAddressList(((msg as any).envelope as any)?.to),
            cc:
              addressText((parsed as any).cc) ||
              formatAddressList(((msg as any).envelope as any)?.cc),
            subject: parsed.subject ?? (msg as any).envelope?.subject ?? "",
            dateIso:
              dateObj instanceof Date ? dateObj.toISOString() : undefined,
            date: (dateObj instanceof Date
              ? dateObj
              : new Date()
            ).toLocaleString(),
            snippet: (parsed.text ?? "").slice(0, 200),
            bodyText: bodyText || "(pas de contenu texte)",
            bodyHtml,
            attachments,
          });
        } catch {
          // ignore per-message parse errors
        }
      }

      out.sort((a, b) => {
        const ta = Date.parse(a.dateIso || a.date || "") || 0;
        const tb = Date.parse(b.dateIso || b.date || "") || 0;
        return ta - tb;
      });

      const trimmed =
        out.length > maxMessages ? out.slice(out.length - maxMessages) : out;
      return trimmed;
    });
  } catch {
    const single = await getMessage(String(uid), mailboxName);
    return [single];
  }
}

export async function getMessageAttachment(args: {
  id: string;
  mailboxName?: string;
  index: number;
}) {
  const uid = Number(args.id);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("Invalid message id");
  if (!Number.isFinite(args.index) || args.index < 0)
    throw new Error("Invalid attachment index");

  const mailboxName = args.mailboxName ?? "INBOX";

  return withImap(async (client) => {
    await client.mailboxOpen(mailboxName, { readOnly: true });

    const msg = await client.fetchOne(
      String(uid),
      {
        source: true,
      },
      { uid: true },
    );

    if (!msg) throw new Error("Message not found");

    const raw = await streamToBuffer(msg.source);
    const parsed = await simpleParser(raw);
    const list = Array.isArray((parsed as any).attachments)
      ? ((parsed as any).attachments as any[])
      : [];

    const att = list[args.index];
    if (!att) throw new Error("Attachment not found");

    const filename =
      typeof att?.filename === "string" && att.filename.trim()
        ? att.filename.trim()
        : "piece-jointe";
    const contentType =
      typeof att?.contentType === "string" && att.contentType.trim()
        ? att.contentType.trim()
        : "application/octet-stream";
    const size = Number.isFinite(att?.size) ? Number(att.size) : undefined;

    const content = await streamToBuffer(att.content);

    return {
      filename,
      contentType,
      size,
      content,
    };
  });
}

export async function sendTextEmail(args: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}) {
  const env = await getMailEnv();

  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.address,
      pass: env.appPassword,
    },
  });

  const info = await transport.sendMail({
    from: env.address,
    to: args.to,
    ...(args.cc ? { cc: args.cc } : {}),
    ...(args.bcc ? { bcc: args.bcc } : {}),
    subject: args.subject,
    text: args.body,
    ...(args.bodyHtml ? { html: args.bodyHtml } : {}),
    ...(args.inReplyTo ? { inReplyTo: args.inReplyTo } : {}),
    ...(args.references?.length ? { references: args.references } : {}),
    ...(args.attachments?.length ? { attachments: args.attachments } : {}),
  });

  return { messageId: info.messageId };
}

export async function markThreadAsSeen(id: string, mailboxName = "INBOX") {
  const uid = Number(id);
  if (!Number.isFinite(uid) || uid <= 0) return;

  await withImap(async (client) => {
    try {
      await client.mailboxOpen(mailboxName, { readOnly: false });
    } catch {
      return;
    }

    try {
      const seed = await client.fetchOne(
        String(uid),
        { threadId: true },
        { uid: true },
      );

      const seedThreadIdRaw = (seed as any)?.threadId;
      const seedThreadId =
        typeof seedThreadIdRaw === "string" && seedThreadIdRaw.trim()
          ? seedThreadIdRaw.trim()
          : "";

      if (seedThreadId) {
        try {
          // Prefer searching only by threadId. Some servers may not support
          // combining threadId with other criteria like seen/unseen.
          const found = await client.search(
            { threadId: seedThreadId } as any,
            { uid: true } as any,
          );
          const uids = Array.isArray(found)
            ? found
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0)
            : [];

          if (uids.length) {
            await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
            return;
          }
        } catch {
          // fall through
        }
      }

      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    } catch {
      // ignore
    }
  });
}

export async function markMessagesAsSeen(ids: string[], mailboxName = "INBOX") {
  const uids = Array.from(
    new Set(
      (ids || [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  );
  if (!uids.length) return;

  await withImap(async (client) => {
    try {
      await client.mailboxOpen(mailboxName, { readOnly: false });
    } catch {
      return;
    }

    try {
      await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    } catch {
      // ignore
    }
  });
}

export async function moveMessageToMailbox(args: {
  id: string;
  fromMailbox: string;
  toMailbox: string;
}) {
  const uid = Number(args.id);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("Invalid message id");

  return withImap(async (client) => {
    await client.mailboxOpen(args.fromMailbox, { readOnly: false });
    return client.messageMove(uid, args.toMailbox, { uid: true });
  });
}

export async function deleteMessageFromMailbox(args: {
  id: string;
  mailbox: string;
}) {
  const uid = Number(args.id);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("Invalid message id");

  return withImap(async (client) => {
    await client.mailboxOpen(args.mailbox, { readOnly: false });
    return client.messageDelete(uid, { uid: true });
  });
}
