import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { error: "Google OAuth disabled (IMAP/SMTP version)" },
    { status: 410 },
  );
}
