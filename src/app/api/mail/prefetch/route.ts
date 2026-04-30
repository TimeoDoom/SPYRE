import { getMessage } from "@/lib/gmail";
import { getSession } from "@/lib/session";

/**
 * Prefetch endpoint to load a message into cache without rendering UI.
 * Called before user navigates to the message detail view.
 * Response is minimal - just needs to trigger the cache population.
 */
// route.ts (prefetch) - Version optimisée
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

    // Utiliser Next.js cache pour éviter les appels répétés
    const cachedMessage = await getMessage(messageId, mailbox);

    // Réponse minimale
    return Response.json({
      ok: true,
      cached: true,
      // Ne renvoyer que les métadonnées pour le cache
      meta: {
        id: cachedMessage.id,
        subject: cachedMessage.subject,
        from: cachedMessage.from,
        date: cachedMessage.date,
      },
    });
  } catch (error) {
    console.error("[prefetch] Error:", error);
    return Response.json(
      { error: "Failed to prefetch message" },
      { status: 500 },
    );
  }
}
