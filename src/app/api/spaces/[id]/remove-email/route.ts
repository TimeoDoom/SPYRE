import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureDbUser,
  isPersistenceEnabled,
  readSpaces,
  removeEmailFromSpaceMailbox,
} from "@/lib/persist";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { emailId } = await req.json();

    if (!emailId) {
      return NextResponse.json({ error: "Email ID required" }, { status: 400 });
    }

    const session = await getSession();

    if (isPersistenceEnabled()) {
      await ensureDbUser(session, { allowCookieWrite: true });
      const { spaces, spaceEmails } = await readSpaces(session);
      if (!spaces.find((s) => s.id === id)) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }
      if (!(spaceEmails as any)?.[id]) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }

      const folder = "INBOX";
      const next = await removeEmailFromSpaceMailbox(
        session,
        id,
        folder,
        emailId,
      );
      const emails = (next as any)?.[id];
      return NextResponse.json({ success: true, emails });
    }

    if (!session.spaces?.find((s) => s.id === id)) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (!session.spaceEmails?.[id]) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Remove from INBOX folder (V1)
    const folder = "INBOX";
    if (session.spaceEmails[id][folder]) {
      session.spaceEmails[id][folder] = session.spaceEmails[id][folder].filter(
        (eid) => eid !== emailId,
      );
    }

    await session.save();

    return NextResponse.json({
      success: true,
      emails: session.spaceEmails[id],
    });
  } catch (error) {
    console.error("[/api/spaces/[id]/remove-email]", error);
    return NextResponse.json(
      { error: "Failed to remove email from space" },
      { status: 500 },
    );
  }
}
