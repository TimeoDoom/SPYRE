import { NextResponse } from "next/server";
import { syncRecentEmails } from "@/lib/sync-service";

export const runtime = "nodejs";

// Cet endpoint sera appelé par un CRON job externe (ex: cron-job.org)
// toutes les 2-3 minutes pour garder les emails à jour
export async function GET(req: Request) {
  // Vérifier un token secret pour sécuriser l'endpoint
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncRecentEmails();
    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[CRON] Error:", error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}