import { ensureDefaultSpace, getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import {
  addEmailToSpaceMailbox,
  ensureDbUser,
  isPersistenceEnabled,
  readSpaces,
} from "@/lib/persist";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { emailId, box } = await req.json();

    if (!emailId) {
      return NextResponse.json({ error: "Email ID required" }, { status: 400 });
    }

    const session = await getSession();
    ensureDefaultSpace(session);

    if (isPersistenceEnabled()) {
      await ensureDbUser(session, { allowCookieWrite: true });
      const { spaces } = await readSpaces(session);
      if (!spaces.find((s) => s.id === id)) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }

      const folder =
        box === "spam"
          ? "[Gmail]/Spam"
          : box === "trash"
            ? "[Gmail]/Trash"
            : box === "drafts"
              ? "DRAFTS"
              : "INBOX";
      const next = await addEmailToSpaceMailbox(session, id, folder, emailId);
      const emails = (next as any)?.[id];
      return NextResponse.json({ success: true, emails });
    }

    if (!session.spaces?.find((s) => s.id === id)) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (!session.spaceEmails) {
      session.spaceEmails = {};
    }

    if (!session.spaceEmails[id]) {
      session.spaceEmails[id] = {
        INBOX: [],
        SENT: [],
        DRAFTS: [],
        "[Gmail]/Spam": [],
        "[Gmail]/Trash": [],
      };
    }

    // Add to INBOX folder by default (V1)
    const folder =
      box === "spam"
        ? "[Gmail]/Spam"
        : box === "trash"
          ? "[Gmail]/Trash"
          : box === "drafts"
            ? "DRAFTS"
            : "INBOX";
    if (!session.spaceEmails[id][folder].includes(emailId)) {
      session.spaceEmails[id][folder].push(emailId);
    }

    await session.save();

    return NextResponse.json({
      success: true,
      emails: session.spaceEmails[id],
    });
  } catch (error) {
    console.error("[/api/spaces/[id]/add-email]", error);
    return NextResponse.json(
      { error: "Failed to add email to space" },
      { status: 500 },
    );
  }
}
