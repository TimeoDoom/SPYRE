"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/app/components/LanguageProvider";

type MailSearchEmail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
};

type Props = {
  emails: MailSearchEmail[];
};

export default function MailGlobalSearch({ emails }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = useLanguage();

  const space = searchParams.get("space") || "principal";
  const box = searchParams.get("box") || "inbox";

  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openSearch = () => {
    setIsOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const closeSearch = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const onOpenSearch = () => {
      openSearch();
    };

    window.addEventListener("mailapp:open-search", onOpenSearch);
    const isEditableTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      if (node.isContentEditable) return true;
      const tag = node.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpen && isEditableTarget(e.target)) return;

      const isMac = navigator.platform.toLowerCase().includes("mac");
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const isK = e.key.toLowerCase() === "k";

      if (isCmdOrCtrl && isK) {
        e.preventDefault();
        if (!isOpen) openSearch();
        return;
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mailapp:open-search", onOpenSearch);
    };
  }, [isOpen]);

  const results = useMemo(() => {
    const q = text.trim().toLocaleLowerCase();
    if (!q) return [] as MailSearchEmail[];

    const tokens = q.split(/\s+/g).filter(Boolean);
    if (!tokens.length) return [] as MailSearchEmail[];

    const matches = (email: MailSearchEmail) => {
      const hay =
        `${email.from || ""} ${email.subject || ""} ${email.snippet || ""}`
          .toLocaleLowerCase()
          .trim();
      return tokens.every((t) => hay.includes(t));
    };

    return (emails || []).filter(matches).slice(0, 12);
  }, [emails, text]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/30"
        aria-label={t(language, "search.close")}
        onClick={closeSearch}
      />

      <div className="relative flex h-full w-full items-start justify-center px-5 pt-20">
        <div className="w-full max-w-[820px]">
          <div className="rounded-[20px] bg-white p-4 shadow-2xl dark:bg-slate-900">
            <input
              ref={inputRef}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-[14px] bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-800/40 dark:text-slate-50"
              placeholder={t(language, "search.placeholder")}
              aria-label={t(language, "search.aria")}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeSearch();
                  return;
                }

                if (e.key === "Enter") {
                  const first = results[0];
                  if (!first) return;
                  const next = new URLSearchParams(searchParams.toString());
                  next.set("space", space);
                  next.set("box", box);
                  next.delete("q");
                  next.set("email", first.id);
                  router.replace(`/mail?${next.toString()}`);
                  closeSearch();
                }
              }}
            />

            <div className="mt-3 overflow-hidden rounded-[16px] bg-white/60 dark:bg-slate-950/20">
              {!text.trim() ? (
                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {t(language, "search.hint")}
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {t(language, "search.noResults")}
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800">
                  {results.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      onClick={() => {
                        const next = new URLSearchParams(
                          searchParams.toString(),
                        );
                        next.set("space", space);
                        next.set("box", box);
                        next.delete("q");
                        next.set("email", email.id);
                        router.replace(`/mail?${next.toString()}`);
                        closeSearch();
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {email.subject || t(language, "mail.noSubject")}
                          </div>
                          <div className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                            {email.date}
                          </div>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                          {email.from}
                        </div>
                        {email.snippet ? (
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {email.snippet}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
