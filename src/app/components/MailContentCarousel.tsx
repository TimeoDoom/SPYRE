"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Space } from "@/lib/session";

type Props = {
  spaces: Space[];
  currentSpaceId: string;
  className?: string;
  snapDistancePx?: number;
  thresholdPx?: number;
  children: React.ReactNode;
};

/**
 * MailContentCarousel: Handles keyboard shortcuts (Cmd/Ctrl+Alt+Shift+1-9)
 * and horizontal drag carousel navigation for spaces.
 */
export default function MailContentCarousel({
  spaces,
  currentSpaceId,
  className,
  snapDistancePx,
  thresholdPx,
  children,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const spaceIds = useMemo(() => (spaces || []).map((s) => s.id), [spaces]);
  const currentIndex = useMemo(
    () => spaceIds.indexOf(currentSpaceId),
    [spaceIds, currentSpaceId],
  );

  const navigateToSpace = useCallback(
    (index: number) => {
      if (!spaceIds.length || index < 0 || index >= spaceIds.length) return;
      const nextSpaceId = spaceIds[index];
      if (nextSpaceId === currentSpaceId) return;
      router.replace(`/mail?space=${encodeURIComponent(nextSpaceId)}`);
    },
    [spaceIds, currentSpaceId, router],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Detect macOS (Cmd+Opt+Shift) or Windows (Ctrl+Alt+Shift)
      const isMacCombo = e.metaKey && e.altKey && e.shiftKey;
      const isWinCombo = e.ctrlKey && e.altKey && e.shiftKey;
      if (!isMacCombo && !isWinCombo) return;

      // Only digits 1-9
      const digit = Number(e.key);
      if (!Number.isFinite(digit) || digit < 1 || digit > 9) return;

      e.preventDefault();
      e.stopPropagation();

      const targetIndex = digit - 1;
      if (targetIndex >= spaceIds.length) return;

      navigateToSpace(targetIndex);
    },
    [spaceIds, navigateToSpace],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, {
      passive: false,
    } as any);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getSnapDistance = () =>
    snapDistancePx ?? containerRef.current?.clientWidth ?? 0;

  const snapAndNavigate = (direction: -1 | 1) => {
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= spaceIds.length) return;

    // Animate to the side
    const d = getSnapDistance();
    setDragX(direction > 0 ? -d : d);

    // Navigate after brief delay
    window.setTimeout(() => {
      navigateToSpace(newIndex);
      setDragX(0);
    }, 150);
  };

  const snapBack = () => {
    setDragX(0);
  };

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full"}
      onPointerDown={(e) => {
        if (pointerIdRef.current !== null) return;
        if (e.button !== 0) return; // Only left click

        const targetEl = e.target as HTMLElement | null;
        // Don't intercept normal interaction (clicking buttons/links, focusing inputs, etc.)
        if (
          targetEl?.closest(
            "button, a, input, textarea, select, [role='button']",
          )
        ) {
          return;
        }

        pointerIdRef.current = e.pointerId;
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        setIsDragging(false);
        setDragX(0);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;

        const dx = e.clientX - startXRef.current;
        const dy = e.clientY - startYRef.current;

        if (!isDragging) {
          // Require horizontal movement to start drag
          if (Math.abs(dx) < 10) return;
          if (Math.abs(dx) < Math.abs(dy)) return; // More vertical → ignore
          setIsDragging(true);

          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // If capture fails, we still allow dragging within the element.
          }
        }

        e.preventDefault();
        setDragX(dx);
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        pointerIdRef.current = null;

        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }

        if (!isDragging) {
          setDragX(0);
          return;
        }

        const snapDistance = getSnapDistance();
        const threshold =
          thresholdPx ?? Math.max(40, Math.round(snapDistance * 0.3));

        if (Math.abs(dragX) >= threshold && spaceIds.length > 1) {
          const direction: -1 | 1 = dragX > 0 ? -1 : 1;
          snapAndNavigate(direction);
        } else {
          snapBack();
        }

        setIsDragging(false);
      }}
      onPointerCancel={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        pointerIdRef.current = null;
        setIsDragging(false);
        snapBack();

        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }}
      style={{
        touchAction: "pan-y",
        transform: `translate3d(${dragX}px, 0, 0)`,
        transition: isDragging ? "none" : "transform 150ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
