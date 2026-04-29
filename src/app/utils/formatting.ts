import { Space } from "@/lib/session";

/**
 * Generates a fallback glyph (initials) from a Space name
 * Used for Space icon display when custom icon is not set
 */
export const getSpaceGlyph = (space: Space): string => {
  const name = (space.name || "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/g).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return letters.length > 0 ? letters.toUpperCase() : "?";
};
