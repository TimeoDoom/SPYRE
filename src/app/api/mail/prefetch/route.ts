import { getMessage } from "@/lib/gmail";
import { getSession } from "@/lib/session";

/**
 * Prefetch endpoint to load a message into cache without rendering UI.
 * Called before user navigates to the message detail view.
 * Response is minimal - just needs to trigger the cache population.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("id");
  const mailbox = searchParams.get("mailbox") || "INBOX";

  if (!messageId) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Simply load the message - this populates the cache in getMessage()
    await getMessage(messageId, mailbox);

    return Response.json({ ok: true, cached: true });
  } catch (error) {
    console.error("[prefetch] Error:", error);
    return Response.json(
      { error: "Failed to prefetch message" },
      { status: 500 },
    );
  }
}
