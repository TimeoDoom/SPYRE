import { ensureDefaultSpace, getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSpace, isPersistenceEnabled } from "@/lib/persist";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    ensureDefaultSpace(session);

    const { name, color, bgColor, icon } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Space name is required" },
        { status: 400 },
      );
    }

    if (isPersistenceEnabled()) {
      const created = await createSpace(session, {
        name: name.trim(),
        color,
        bgColor,
        icon,
      });

      if (!created) {
        return NextResponse.json(
          { error: "Failed to create space" },
          { status: 500 },
        );
      }

      return NextResponse.json(created, { status: 201 });
    }

    // Fallback: cookie-session storage
    if (!session.spaces) {
      session.spaces = [];
    }

    const newSpace = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color || "#3B82F6",
      bgColor: bgColor || "#F0F4FF",
      textColor: "#1E293B",
      icon: icon || "📁",
      createdAt: new Date(),
    };

    session.spaces.push(newSpace);

    if (!session.spaceEmails) {
      session.spaceEmails = {};
    }
    session.spaceEmails[newSpace.id] = {
      INBOX: [],
      SENT: [],
      DRAFTS: [],
      "[Gmail]/Spam": [],
      "[Gmail]/Trash": [],
    };

    await session.save();

    return NextResponse.json(newSpace, { status: 201 });
  } catch (error) {
    console.error("[/api/spaces/create]", error);
    return NextResponse.json(
      { error: "Failed to create space" },
      { status: 500 },
    );
  }
}
