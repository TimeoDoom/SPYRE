"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SplitViewProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Initial ratio of the left pane, between 0 and 1. */
  initialLeftRatio?: number;
  /** Minimum width in px for each pane. */
  minPaneWidthPx?: number;
  className?: string;
};

export default function SplitView({
  left,
  right,
  initialLeftRatio = 0.5,
  minPaneWidthPx = 280,
  className,
}: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [leftRatio, setLeftRatio] = useState(() => {
    const r = Number.isFinite(initialLeftRatio) ? initialLeftRatio : 0.5;
    return Math.max(0.1, Math.min(0.9, r));
  });

  const leftPercent = useMemo(() => `${leftRatio * 100}%`, [leftRatio]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const total = rect.width;
      if (!total) return;

      const x = e.clientX - rect.left;

      const minRatio = minPaneWidthPx / total;
      const maxRatio = 1 - minPaneWidthPx / total;

      const next = x / total;
      const clamped = Math.max(minRatio, Math.min(maxRatio, next));
      setLeftRatio(clamped);

      e.preventDefault();
    };

    const handlePointerUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    } as any);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove as any);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, minPaneWidthPx]);

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "flex h-full min-h-0 min-w-0 flex-1 items-stretch overflow-hidden"
      }
      style={{ userSelect: isDragging ? "none" : undefined }}
    >
      <div className="min-w-0 shrink-0" style={{ width: leftPercent }}>
        <div className="h-full min-h-0 min-w-0 overflow-auto">{left}</div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize"
        className="relative z-10 w-2 shrink-0 cursor-col-resize bg-slate-200/70 dark:bg-slate-800"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          setIsDragging(true);
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }}
        onPointerUp={(e) => {
          setIsDragging(false);
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="h-full min-h-0 min-w-0 overflow-auto">{right}</div>
      </div>
    </div>
  );
}
