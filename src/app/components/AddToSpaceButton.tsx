"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Space } from "@/lib/session";
import { SpaceIcon } from "./SpaceIcon";

type Props = {
  emailId: string;
  spaces: Space[];
};

export default function AddToSpaceButton({ emailId, spaces }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  const handleAddToSpace = async (spaceId: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/spaces/${encodeURIComponent(spaceId)}/add-email`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ emailId, box: "inbox" }),
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        alert(data?.error || "Impossible d'ajouter l'email au Space");
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch {
      alert("Impossible d'ajouter l'email au Space");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <span aria-hidden="true">＋</span>
        Ajouter au Space
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Déplacer vers
          </div>
          <div className="max-h-72 overflow-auto">
            {spaces.length ? (
              spaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => void handleAddToSpace(space.id)}
                  disabled={isSubmitting}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SpaceIcon space={space} size={16} />
                  <span className="min-w-0 truncate">{space.name}</span>
                </button>
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-slate-500">
                Aucun Space disponible
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
