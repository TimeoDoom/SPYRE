import { ensureDefaultSpace, getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import {
  deleteSpace,
  isPersistenceEnabled,
  readSpaces,
  updateSpace,
} from "@/lib/persist";

function isHexColor(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function normalizeHex(value: unknown): string | undefined {
  if (!isHexColor(value)) return undefined;
  const v = value.trim();
  if (v.length === 4) {
    const h = v.slice(1);
    return (
      "#" +
      h
        .split("")
        .map((c) => c + c)
        .join("")
    ).toUpperCase();
  }
  return v.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return null;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function mixWithWhite(hex: string, amount = 0.9): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#F8FAFC";
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const a = clamp01(amount);
  const mix = (c: number) => Math.round(c * (1 - a) + 255 * a);
  const toHex2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex2(mix(rgb.r))}${toHex2(mix(rgb.g))}${toHex2(mix(rgb.b))}`;
}

function normalizeAngle(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(360, value));
}

function normalizeBackground(
  value: unknown,
):
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string; angle?: number }
  | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as any;
  if (v.kind === "solid") {
    const color = normalizeHex(v.color);
    if (!color) return undefined;
    return { kind: "solid", color };
  }
  if (v.kind === "gradient") {
    const from = normalizeHex(v.from);
    const to = normalizeHex(v.to);
    if (!from || !to) return undefined;
    const angle = normalizeAngle(v.angle);
    return angle === undefined
      ? { kind: "gradient", from, to }
      : { kind: "gradient", from, to, angle };
  }
  return undefined;
}

function normalizeFontSizePx(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  if (rounded < 11 || rounded > 20) return undefined;
  return rounded;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    ensureDefaultSpace(session);

    const { spaces } = await readSpaces(session);
    const existing = spaces.find((s) => s.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const nextName =
      typeof body?.name === "string" ? body.name.trim() : undefined;
    const nextIcon =
      typeof body?.icon === "string" ? body.icon.trim() : undefined;

    const nextColor = normalizeHex(body?.color);
    const nextBgColor = normalizeHex(body?.bgColor);

    const nextColumnBgColor =
      body?.columnBgColor === null ? null : normalizeHex(body?.columnBgColor);

    const nextColumnBackground =
      body?.columnBackground === null
        ? null
        : normalizeBackground(body?.columnBackground);

    const nextTextColor =
      body?.textColor === null ? null : normalizeHex(body?.textColor);

    const nextButtonBgColor =
      body?.buttonBgColor === null ? null : normalizeHex(body?.buttonBgColor);

    const nextRailGradientFrom =
      body?.railGradientFrom === null
        ? null
        : normalizeHex(body?.railGradientFrom);
    const nextRailGradientTo =
      body?.railGradientTo === null ? null : normalizeHex(body?.railGradientTo);

    const nextAppBackground =
      body?.appBackground === null
        ? null
        : normalizeBackground(body?.appBackground);

    const nextMailFont =
      body?.mailFont === "inter" ||
      body?.mailFont === "system" ||
      body?.mailFont === "mono"
        ? (body.mailFont as "inter" | "system" | "mono")
        : undefined;

    const nextMailFontSize =
      body?.mailFontSize === null
        ? null
        : normalizeFontSizePx(body?.mailFontSize);

    if (isPersistenceEnabled()) {
      const nextSpace: any = {};
      if (nextName) nextSpace.name = nextName;
      if (nextIcon) nextSpace.icon = nextIcon;
      if (nextMailFont) nextSpace.mailFont = nextMailFont;

      if (nextMailFontSize === null) nextSpace.mailFontSize = null;
      else if (typeof nextMailFontSize === "number")
        nextSpace.mailFontSize = nextMailFontSize;

      if (nextRailGradientFrom === null) nextSpace.railGradientFrom = null;
      else if (nextRailGradientFrom)
        nextSpace.railGradientFrom = nextRailGradientFrom;

      if (nextRailGradientTo === null) nextSpace.railGradientTo = null;
      else if (nextRailGradientTo)
        nextSpace.railGradientTo = nextRailGradientTo;

      if (nextAppBackground === null) nextSpace.appBackground = null;
      else if (nextAppBackground) nextSpace.appBackground = nextAppBackground;

      if (nextColumnBackground === null) nextSpace.columnBackground = null;
      else if (nextColumnBackground)
        nextSpace.columnBackground = nextColumnBackground;

      if (nextColumnBgColor === null) nextSpace.columnBgColor = null;
      else if (nextColumnBgColor) nextSpace.columnBgColor = nextColumnBgColor;

      if (nextTextColor === null) nextSpace.textColor = null;
      else if (nextTextColor) nextSpace.textColor = nextTextColor;

      if (nextButtonBgColor === null) nextSpace.buttonBgColor = null;
      else if (nextButtonBgColor) nextSpace.buttonBgColor = nextButtonBgColor;

      if (nextColor) {
        nextSpace.color = nextColor;
        nextSpace.bgColor = nextBgColor ?? mixWithWhite(nextColor, 0.92);
      } else if (nextBgColor) {
        nextSpace.bgColor = nextBgColor;
      }

      const ok = await updateSpace(session, id, nextSpace);
      if (!ok) {
        return NextResponse.json(
          { error: "Failed to update space" },
          { status: 500 },
        );
      }

      const after = await readSpaces(session);
      const updated = after.spaces.find((s) => s.id === id);
      if (!updated) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    // Fallback: cookie-session update
    if (!session.spaces) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const index = session.spaces.findIndex((s) => s.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const space = session.spaces[index];
    if (nextName) space.name = nextName;
    if (nextIcon) space.icon = nextIcon;
    if (nextMailFont) space.mailFont = nextMailFont;

    if (nextMailFontSize === null) delete (space as any).mailFontSize;
    else if (typeof nextMailFontSize === "number")
      (space as any).mailFontSize = nextMailFontSize;

    if (nextRailGradientFrom === null) delete (space as any).railGradientFrom;
    else if (nextRailGradientFrom)
      space.railGradientFrom = nextRailGradientFrom;

    if (nextRailGradientTo === null) delete (space as any).railGradientTo;
    else if (nextRailGradientTo) space.railGradientTo = nextRailGradientTo;

    if (nextAppBackground === null) delete (space as any).appBackground;
    else if (nextAppBackground)
      (space as any).appBackground = nextAppBackground;

    if (nextColumnBackground === null) delete (space as any).columnBackground;
    else if (nextColumnBackground)
      (space as any).columnBackground = nextColumnBackground;

    if (nextColumnBgColor === null) delete (space as any).columnBgColor;
    else if (nextColumnBgColor)
      (space as any).columnBgColor = nextColumnBgColor;

    if (nextTextColor === null) delete (space as any).textColor;
    else if (nextTextColor) (space as any).textColor = nextTextColor;

    if (nextButtonBgColor === null) delete (space as any).buttonBgColor;
    else if (nextButtonBgColor)
      (space as any).buttonBgColor = nextButtonBgColor;

    if (nextColor) {
      space.color = nextColor;
      space.bgColor = nextBgColor ?? mixWithWhite(nextColor, 0.92);
    } else if (nextBgColor) {
      space.bgColor = nextBgColor;
    }

    await session.save();
    return NextResponse.json(space);
  } catch (error) {
    console.error("[/api/spaces/[id]] PATCH", error);
    return NextResponse.json(
      { error: "Failed to update space" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    ensureDefaultSpace(session);

    if (isPersistenceEnabled()) {
      const ok = await deleteSpace(session, id);
      if (!ok) {
        return NextResponse.json({ error: "Space not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (!session.spaces) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const index = session.spaces.findIndex((s) => s.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    session.spaces.splice(index, 1);

    // Remove associated emails
    if (session.spaceEmails) {
      delete session.spaceEmails[id];
    }

    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/spaces/[id]]", error);
    return NextResponse.json(
      { error: "Failed to delete space" },
      { status: 500 },
    );
  }
}
