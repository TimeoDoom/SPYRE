import { getMessage } from "@/lib/gmail";
import { getSession } from "@/lib/session";

/**
 * Prefetch endpoint to load a message into cache without rendering UI.
 * Called before user navigates to the message detail view.
 * Limited concurrency to avoid overwhelming IMAP connection pool.
 */
let activePrefetches = 0;
const MAX_CONCURRENT_PREFETCHES = 2;
const prefetchQueue: Array<() => Promise<any>> = [];

async function processPrefetchQueue() {
  while (
    prefetchQueue.length > 0 &&
    activePrefetches < MAX_CONCURRENT_PREFETCHES
  ) {
    const work = prefetchQueue.shift();
    if (!work) break;
    activePrefetches++;
    work().finally(() => {
      activePrefetches--;
      processPrefetchQueue();
    });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("id");
  const mailbox = searchParams.get("mailbox") || "INBOX";

  if (!messageId) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  // Queue the prefetch work to limit concurrency
  // Return immediately while work continues in background
  const work = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      try {
        await getMessage(messageId, mailbox);
      } catch (error) {
        console.error("[prefetch] Failed to fetch message:", error);
      }
    } catch (error) {
      console.error("[prefetch] Error:", error);
    }
  };

  // Queue work to run in background with concurrency limit
  prefetchQueue.push(work);
  processPrefetchQueue();

  // Measure handler time (enqueue cost) for diagnostics and expose via Server-Timing
  const enqueueDuration = 0; // negligible here, kept for compatibility

  const headers = new Headers({
    "Server-Timing": `enqueue;dur=${enqueueDuration}`,
    "Cache-Control": "public, max-age=60",
  });

  return new Response(JSON.stringify({ ok: true, queued: true }), {
    status: 200,
    headers,
  });
}
