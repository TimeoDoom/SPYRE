"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EmailDetail from "@/app/components/EmailDetail";
import { EmailListWithPrefetch } from "@/app/components/EmailListWithPrefetch";
import MailContentCarousel from "@/app/components/MailContentCarousel";
import SpacesRail from "@/app/components/SpacesRail";
import SplitView from "@/app/components/SplitView";
import type { Space } from "@/lib/session";
import { t } from "@/lib/i18n";

type EmailListItem = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  threadCount?: number;
  threadHasReply?: boolean;
  threadUnreadCount?: number;
  threadMemberIds?: string[];
};

type Props = {
  language: "fr" | "en";
  spaces: Space[];
  currentSpaceId: string;
  activityBySpaceId: Record<string, boolean>;
  emails: EmailListItem[];
  spaceName: string;
  accentColor: string;
  columnBgStyle?: CSSProperties;
  textColor?: string;
  buttonBgColor?: string;
  mailFontSize?: number;

  errorMsg?: string;
  selectedEmailId?: string;
  selectedEmail?: any;
  selectedThread?: any[];
  selectedEmailId2?: string;
  selectedEmail2?: any;
  selectedThread2?: any[];
  meEmail?: string;
  mailboxName?: string;
  space: Space;
};

function ToggleIcon({ direction }: { direction: "left" | "right" }) {
  // Minimal chevron icon
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-slate-600 dark:text-slate-200"
    >
      {direction === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 6l6 6-6 6" />
      )}
    </svg>
  );
}

export default function MailColumns(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listVisible, setListVisible] = useState(true);

  const currentBox = (searchParams.get("box") || "inbox").trim() || "inbox";
  const currentQuery = (searchParams.get("q") || "").trim();

  const buildMailHref = (emailId?: string | null, emailId2?: string | null) => {
    const base = `/mail?space=${encodeURIComponent(props.currentSpaceId)}&box=${encodeURIComponent(currentBox)}${currentQuery ? `&q=${encodeURIComponent(currentQuery)}` : ""}`;
    const p = emailId ? `&email=${encodeURIComponent(emailId)}` : "";
    const s = emailId2 ? `&email2=${encodeURIComponent(emailId2)}` : "";
    return `${base}${p}${s}`;
  };

  const isSplitActive = Boolean(
    props.selectedEmailId &&
    props.selectedEmail &&
    props.selectedEmailId2 &&
    props.selectedEmail2,
  );

  const getDroppedEmailId = (e: React.DragEvent) => {
    const raw =
      e.dataTransfer.getData("application/x-mailapp-email-id") ||
      e.dataTransfer.getData("text/plain") ||
      "";
    return (raw || "").trim();
  };

  const dropOnPane = (side: "left" | "right", droppedId: string) => {
    const primary = (props.selectedEmailId || "").trim();
    const secondary = (props.selectedEmailId2 || "").trim();

    if (!droppedId) return;

    // No selection yet => set primary.
    if (!primary) {
      router.replace(buildMailHref(droppedId, null));
      return;
    }

    if (side === "left") {
      if (droppedId === primary) return;

      // If no secondary, simply replace primary.
      if (!secondary) {
        router.replace(buildMailHref(droppedId, null));
        return;
      }

      // Dropping the email currently on the right onto the left => swap.
      if (droppedId === secondary) {
        router.replace(buildMailHref(droppedId, primary));
        return;
      }

      router.replace(buildMailHref(droppedId, secondary));
      return;
    }

    // side === "right"
    if (!secondary) {
      if (droppedId === primary) return;
      router.replace(buildMailHref(primary, droppedId));
      return;
    }

    if (droppedId === secondary) return;

    // Dropping the email currently on the left onto the right => swap.
    if (droppedId === primary) {
      router.replace(buildMailHref(secondary, droppedId));
      return;
    }

    router.replace(buildMailHref(primary, droppedId));
  };

  const ui = useMemo(() => {
    if (props.language === "en") {
      return {
        hide: "Hide email list",
        show: "Show email list",
      } as const;
    }
    return {
      hide: "Masquer la liste des emails",
      show: "Afficher la liste des emails",
    } as const;
  }, [props.language]);

  return (
    <div className="mail-app-container">
      <MailContentCarousel
        spaces={props.spaces}
        currentSpaceId={props.currentSpaceId}
        className="relative z-30 h-full shrink-0"
        snapDistancePx={88}
        thresholdPx={44}
      >
        <SpacesRail
          spaces={props.spaces}
          activityBySpaceId={props.activityBySpaceId}
        />
      </MailContentCarousel>

      <div className="relative h-full shrink-0">
        {listVisible ? (
          <EmailListWithPrefetch
            emails={props.emails}
            mailbox={props.mailboxName ?? "INBOX"}
            spaceName={props.spaceName}
            accentColor={props.accentColor}
            columnBgStyle={props.columnBgStyle}
            textColor={props.textColor}
            buttonBgColor={props.buttonBgColor}
            mailFontSize={props.mailFontSize}
          />
        ) : null}

        <button
          type="button"
          onClick={() => setListVisible((v) => !v)}
          aria-label={listVisible ? ui.hide : ui.show}
          title={listVisible ? ui.hide : ui.show}
          className="absolute right-0 top-1/2 z-40 grid h-9 w-7 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <ToggleIcon direction={listVisible ? "left" : "right"} />
        </button>
      </div>

      {/* Reading pane */}
      <div
        className="min-h-0 min-w-0 flex-1"
        onDragOver={(e) => {
          // Allow dropping emails from the list.
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();

          // When split is active, each pane handles its own drop.
          if (isSplitActive) return;

          const droppedId = getDroppedEmailId(e);
          if (!droppedId) return;

          const primary = (props.selectedEmailId || "").trim();
          const secondary = (props.selectedEmailId2 || "").trim();

          // If nothing selected, fill primary.
          if (!primary) {
            router.replace(buildMailHref(droppedId, null));
            return;
          }

          // If dropping the same as primary, do nothing.
          if (droppedId === primary) return;

          // If no secondary yet, fill it.
          if (!secondary) {
            router.replace(buildMailHref(primary, droppedId));
            return;
          }

          // Otherwise replace secondary.
          router.replace(buildMailHref(primary, droppedId));
        }}
      >
        {props.errorMsg ? (
          <div className="email-detail">
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-[20px] border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/40">
                <div className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
                  {t(props.language, "mail.errorTitle")}
                </div>
                <div className="mb-4 text-sm text-red-800 dark:text-red-200">
                  {props.errorMsg}
                </div>
                <a
                  href="/settings"
                  className="inline-block rounded-[14px] bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  {t(props.language, "mail.configureSettings")}
                </a>
              </div>
            </div>
          </div>
        ) : props.selectedEmailId && props.selectedEmail ? (
          props.selectedEmailId2 && props.selectedEmail2 ? (
            <SplitView
              left={
                <div
                  className="h-full min-h-0"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const droppedId = getDroppedEmailId(e);
                    dropOnPane("left", droppedId);
                  }}
                >
                  <EmailDetail
                    email={props.selectedEmail}
                    emailId={props.selectedEmailId}
                    space={props.space}
                    thread={props.selectedThread ?? undefined}
                    meEmail={props.meEmail}
                  />
                </div>
              }
              right={
                <div
                  className="h-full min-h-0"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const droppedId = getDroppedEmailId(e);
                    dropOnPane("right", droppedId);
                  }}
                >
                  <EmailDetail
                    email={props.selectedEmail2}
                    emailId={props.selectedEmailId2}
                    space={props.space}
                    thread={props.selectedThread2 ?? undefined}
                    meEmail={props.meEmail}
                  />
                </div>
              }
            />
          ) : (
            <EmailDetail
              email={props.selectedEmail}
              emailId={props.selectedEmailId}
              space={props.space}
              thread={props.selectedThread ?? undefined}
              meEmail={props.meEmail}
            />
          )
        ) : (
          <div className="email-detail">
            <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <div className="text-lg">
                  {t(props.language, "mail.selectEmailTitle")}
                </div>
                <div className="mt-1 text-sm">
                  {t(props.language, "mail.selectEmailSubtitle")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
