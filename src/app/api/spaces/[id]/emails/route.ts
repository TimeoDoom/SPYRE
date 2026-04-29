import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { isPersistenceEnabled, readSpaces } from "@/lib/persist";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (isPersistenceEnabled()) {
      const { spaces, spaceEmails } = await readSpaces(session);
      if (!spaces.find((s) => s.id === id)) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }

      const emailsByFolder = (spaceEmails as any)?.[id] || {
        INBOX: [],
        SENT: [],
        DRAFTS: [],
        "[Gmail]/Spam": [],
        "[Gmail]/Trash": [],
      };

      return NextResponse.json({
        spaceId: id,
        emailsByFolder,
        count: emailsByFolder.INBOX?.length || 0,
      });
    }

    if (!session.spaces?.find((s) => s.id === id)) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const emailsByFolder = session.spaceEmails?.[id] || {
      INBOX: [],
      SENT: [],
      DRAFTS: [],
      "[Gmail]/Spam": [],
      "[Gmail]/Trash": [],
    };

    return NextResponse.json({
      spaceId: id,
      emailsByFolder,
      count: emailsByFolder.INBOX?.length || 0,
    });
  } catch (error) {
    console.error("[/api/spaces/[id]/emails]", error);
    return NextResponse.json(
      { error: "Failed to fetch space emails" },
      { status: 500 },
    );
  }
}
