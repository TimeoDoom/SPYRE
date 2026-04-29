import React from 'react';
import { Space } from '@/lib/session';

export const AVAILABLE_ICONS = [
  { id: 'bicycle', path: 'M5.5 17.5a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0z M13.5 17.5a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0z M12 17.5V14l-3-3-4 4 M12 14l3-3 M15 11l-2-4h5' },
  { id: 'car', path: 'M1.5 12h21 M4.5 12l1-4h13l1 4 M2 12v6h3v-2h14v2h3v-6 M6 15a1 1 0 102 0 1 1 0 10-2 0z M16 15a1 1 0 102 0 1 1 0 10-2 0z' },
  { id: 'film', path: 'M2 5h20v14H2z M2 9h20 M2 14h20 M7 5v14 M17 5v14' },
  { id: 'baby', path: 'M12 10a4 4 0 100-8 4 4 0 000 8z M12 10v10 M10 14l-2 2 M14 14l2 2 M12 22a8 8 0 01-8-8 M20 14a8 8 0 01-8 8' },
  { id: 'fork-knife', path: 'M18 2v20 M2 2v12c0 3 3 6 3 6h2 M2 2v6 M5 2v6 M8 2v6' },
  { id: 'trophy', path: 'M6 9H4.5a2.5 2.5 0 010-5H6 M18 9h1.5a2.5 2.5 0 000-5H18 M12 15V19 M9 21h6 M12 4a6 6 0 016 6v3a6 6 0 01-12 0v-3a6 6 0 016-6z' },
  { id: 'truck', path: 'M1 14h15V6H1z M16 14h6l2-4V6h-8z M4 17a2 2 0 104 0 2 2 0 10-4 0z M18 17a2 2 0 104 0 2 2 0 10-4 0z' },
  { id: 'cow', path: 'M7 15l-3 4 M17 15l3 4 M5 8h14l-2 10H7z M7 5a3 3 0 0110 0' },
  { id: 'tennis', path: 'M12 21a9 9 0 100-18 9 9 0 000 18z M5.5 10.5c3.5 0 6.5 3 6.5 6.5 M12 7c0 3.5 3 6.5 6.5 6.5' },
  { id: 'umbrella', path: 'M12 19V5a7 7 0 1114 0 M12 19a2 2 0 11-4 0' },
  { id: 'bus', path: 'M4 18h16v-12H4z M17 6l1-3h-12l1 3 M6 18a2 2 0 104 0 2 2 0 10-4 0z M14 18a2 2 0 104 0 2 2 0 10-4 0z' },
  { id: 'mail', path: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' },
];

export const AVAILABLE_EMOJIS = ['💼', '🏠', '🍔', '✈️', '🎮', '🏋️', '📚', '🎨', '🎵', '💻', '🌟', '❤️'];

interface SpaceIconProps {
  space: Space;
  size?: number;
}

export function SpaceIcon({ space, size = 20 }: SpaceIconProps) {
  const getFallbackGlyph = (s: Space): string => {
    const name = (s.name || "").trim();
    if (!name) return "?";
    const parts = name.split(/\s+/g).filter(Boolean);
    const letters = parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase();
    return (letters || name[0] || "?").slice(0, 2);
  };

  // For Principal space, we want the envelope icon unless another one is explicitly set
  // (Note: session.ts might default it to 📥 which we want to override with our mail icon)
  const effectiveIcon = space.id === 'principal' && (!space.icon || space.icon === '📥') 
    ? 'mail' 
    : space.icon;

  if (!effectiveIcon) return <span>{getFallbackGlyph(space)}</span>;

  // 1. Check if it's a predefined SVG icon
  const iconDef = AVAILABLE_ICONS.find(i => i.id === effectiveIcon);
  if (iconDef) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: `${size}px`, height: `${size}px` }}>
        <path d={iconDef.path} />
      </svg>
    );
  }

  // 2. Check if it's an emoji (either in our list or any emoji)
  // We consider any short string (<= 8 chars to be safe with complex emojis) as a potential emoji/glyph
  if (effectiveIcon.length <= 8) {
    return <span style={{ fontSize: `${size}px`, display: 'inline-block', lineHeight: 1 }}>{effectiveIcon}</span>;
  }

  return <span>{getFallbackGlyph(space)}</span>;
}
