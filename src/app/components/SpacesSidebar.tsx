"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Space } from "@/lib/session";
import { SpaceIcon } from "./SpaceIcon";

type Props = {
  initialSpaces: Space[];
};

export default function SpacesSidebar({ initialSpaces }: Props) {
  const pathname = usePathname();
  const spaces = [...initialSpaces].sort((a, b) => {
    if (a.id === "principal") return -1;
    if (b.id === "principal") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-lg font-semibold text-slate-900">Spaces</div>
        <div className="mt-1 text-sm text-slate-500">
          Navigation des espaces
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {spaces.map((space) => {
          const href = `/spaces/${encodeURIComponent(space.id)}`;
          const isActive = pathname === href;

          return (
            <Link
              key={space.id}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <SpaceIcon space={space} size={18} />
              <span className="min-w-0 truncate">{space.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
        Ouvre un Space pour voir ses emails.
      </div>
    </aside>
  );
}
