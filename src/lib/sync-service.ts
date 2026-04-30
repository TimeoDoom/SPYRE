import "server-only";
import { prisma } from "./db";
import { getMailEnv } from "./gmail-sync";

// Ce fichier sera appelé par un CRON job pour synchroniser les emails
// en arrière-plan, rendant le frontend instantané.

export async function syncRecentEmails() {
  if (!prisma) {
    console.log("[Sync] Database not available, skipping sync");
    return;
  }

  console.log("[Sync] Starting email sync...");
  const startTime = Date.now();

  try {
    const ImapFlow = (await import("imapflow")).ImapFlow;
    const { simpleParser } = await import("mailparser");
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

    await client.connect();
    
    const folders = ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/Spam", "[Gmail]/Trash"];
    
    for (const folder of folders) {
      try {
        await client.mailboxOpen(folder, { readOnly: true });
      } catch {
        console.log(`[Sync] Cannot open folder: ${folder}`);
        continue;
      }

      const mailbox = client.mailbox;
      if (!mailbox || !mailbox.exists) continue;

      const exists = mailbox.exists;
      const fetchCount = Math.min(50, exists); // Sync last 50 emails
      const start = Math.max(1, exists - fetchCount + 1);
      
      console.log(`[Sync] Fetching ${start}:${exists} from ${folder}`);
      
      for await (const msg of client.fetch(`${start}:${exists}`, {
        uid: true,
        envelope: true,
        internalDate: true,
        source: true,
        flags: true,
      })) {
        try {
          const uid = String((msg as any).uid);
          const env = msg.envelope as any;
          const flags = getFlagsArray((msg as any).flags);
          
          // Vérifier si l'email existe déjà en DB
          const existing = await prisma.emailMetadata.findUnique({
            where: { id: `${folder}:${uid}` },
            select: { id: true },
          });

          if (existing) {
            // Mettre à jour les flags seulement
            await prisma.emailMetadata.update({
              where: { id: `${folder}:${uid}` },
              data: {
                seen: flags.includes("\\Seen"),
                flagged: flags.includes("\\Flagged"),
                updatedAt: new Date(),
              },
            });
            continue;
          }

          // Parser le message
          const raw = await streamToBuffer((msg as any).source);
          const parsed = await simpleParser(raw, {
            skipHtmlToText: true,
            skipTextToHtml: true,
          });

          // Enregistrer dans la DB
          await prisma.emailMetadata.create({
            data: {
              id: `${folder}:${uid}`,
              uid: uid,
              folder: folder,
              subject: parsed.subject || "",
              from: formatAddressList(env?.from) || "",
              to: formatAddressList(env?.to) || "",
              date: env?.date || new Date(),
              snippet: (parsed.text || "").slice(0, 300),
              seen: flags.includes("\\Seen"),
              flagged: flags.includes("\\Flagged"),
              hasAttachments: Array.isArray(parsed.attachments) && parsed.attachments.length > 0,
              bodyText: parsed.text || "",
              bodyHtml: parsed.html || "",
              messageId: parsed.messageId || "",
              inReplyTo: (parsed as any).inReplyTo || "",
              references: JSON.stringify((parsed as any).references || []),
              rawSize: raw.length,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          console.log(`[Sync] Saved email: ${uid} from ${folder}`);
        } catch (error) {
          console.error(`[Sync] Error processing email:`, error);
        }
      }
    }

    await client.logout();
    
    // Nettoyer les vieux emails (garder 200 max)
    const totalEmails = await prisma.emailMetadata.count();
    if (totalEmails > 200) {
      const toDelete = totalEmails - 200;
      const oldestEmails = await prisma.emailMetadata.findMany({
        orderBy: { date: "asc" },
        take: toDelete,
        select: { id: true },
      });
      
      if (oldestEmails.length > 0) {
        await prisma.emailMetadata.deleteMany({
          where: {
            id: {
              in: oldestEmails.map(e => e.id),
            },
          },
        });
        console.log(`[Sync] Cleaned up ${oldestEmails.length} old emails`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync] Completed in ${duration}ms`);
  } catch (error) {
    console.error("[Sync] Error:", error);
  }
}

function formatAddressList(list: any): string {
  if (!list || !Array.isArray(list)) return "";
  return list
    .map((addr: any) => {
      if (addr.name) return `${addr.name} <${addr.address}>`;
      return addr.address || "";
    })
    .filter(Boolean)
    .join(", ");
}

function getFlagsArray(flags: any): string[] {
  if (Array.isArray(flags)) return flags.filter((f: any) => typeof f === "string");
  if (typeof flags === "string") return [flags];
  if (flags && typeof flags === "object" && typeof flags[Symbol.iterator] === "function") {
    return Array.from(flags as Iterable<any>).filter((f): f is string => typeof f === "string");
  }
  return [];
}

async function streamToBuffer(input: any): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input;
  if (!input || typeof input !== "object") return Buffer.from("");
  
  const stream = input as AsyncIterable<Uint8Array | Buffer | string>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}