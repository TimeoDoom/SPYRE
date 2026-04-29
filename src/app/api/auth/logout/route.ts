import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // No session in IMAP/SMTP version; keep route for backward compatibility.
  return NextResponse.redirect(new URL("/", req.url));
}
