import { getSession, ensureDefaultSpace } from "@/lib/session";
import { readSpaces } from "@/lib/persist";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    ensureDefaultSpace(session);

    const { spaces, spaceEmails } = await readSpaces(session);
    return NextResponse.json({ spaces, spaceEmails });
  } catch (error) {
    console.error("[/api/spaces]", error);
    return NextResponse.json(
      { error: "Failed to fetch spaces" },
      { status: 500 },
    );
  }
}
