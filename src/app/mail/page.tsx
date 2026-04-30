import { redirect } from "next/navigation";
import {
  getMailboxes,
  getMessage,
  getThreadMessages,
  listMailboxThreads,
  markMessagesAsSeen,
  markThreadAsSeen,
} from "@/lib/gmail";
import { getSession, ensureDefaultSpace } from "@/lib/session";
import type { CSSProperties } from "react";
import MailGlobalSearch from "@/app/components/MailGlobalSearch";
import MailColumns from "@/app/mail/_columns";
import type { UiBackground } from "@/lib/session";
import { normalizeAppLanguage, t } from "@/lib/i18n";
import { readMailSettings, readSpaces, readUiSettings } from "@/lib/persist";

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

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MailPage(props: PageProps) {
  const session = await getSession();
  ensureDefaultSpace(session);
  const ui = await readUiSettings(session);
  const language = normalizeAppLanguage(ui.language);

  const sp = (await props.searchParams) ?? {};

  // Redirect if no space specified
  if (!sp.space) {
    redirect("/mail?space=principal");
  }

  const spaceId = typeof sp.space === "string" ? sp.space : "principal";
  const selectedEmailId = typeof sp.email === "string" ? sp.email : undefined;
  const selectedEmailId2Raw =
    typeof sp.email2 === "string" ? sp.email2 : undefined;
  const selectedEmailId2 =
    selectedEmailId2Raw && selectedEmailId2Raw !== selectedEmailId
      ? selectedEmailId2Raw
      : undefined;
  const primaryEmailId = selectedEmailId ?? selectedEmailId2;
  const secondaryEmailId = selectedEmailId ? selectedEmailId2 : undefined;
  const boxParam = typeof sp.box === "string" ? sp.box : "inbox";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const box =
    boxParam === "drafts" ||
    boxParam === "spam" ||
    boxParam === "trash" ||
    boxParam === "inbox"
      ? boxParam
      : "inbox";

  const { spaces, spaceEmails } = await readSpaces(session);
  const principalSpace =
    spaces.find((s) => s.id === "principal") ||
    ({
      id: "principal",
      name: "Principal",
      icon: "📥",
      color: "#3B82F6",
      bgColor: "#F0F4FF",
      textColor: "#1E293B",
      createdAt: new Date(),
    } as any);

  const currentSpace = spaces.find((s) => s.id === spaceId) || principalSpace;
  const resolvedSpaceId = currentSpace.id;

  // If someone navigates to an unknown space, redirect once to a valid one.
  if (resolvedSpaceId !== spaceId) {
    redirect(`/mail?space=${encodeURIComponent(resolvedSpaceId)}`);
  }

  let emailList: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    threadCount?: number;
    threadHasReply?: boolean;
    threadUnreadCount?: number;
    threadMemberIds?: string[];
  }> = [];
  let selectedEmail: any = null;
  let selectedThread: any[] | null = null;
  let selectedEmail2: any = null;
  let selectedThread2: any[] | null = null;
  let meEmail: string | undefined = undefined;
  let selectedMailboxName = "INBOX";
  let errorMsg = "";

  try {
    // Check if Gmail is configured first
    const mail = await readMailSettings(session);
    if (!mail?.address || !mail.appPassword) {
      throw new Error(t(language, "mail.notConfigured"));
    }

    const systemBoxes = await getMailboxes();
    const mailboxName = (() => {
      if (box === "inbox") return "INBOX";
      if (box === "spam")
        return (
          systemBoxes.find((c) => c.label === "Spam")?.name || "[Gmail]/Spam"
        );
      if (box === "trash")
        return (
          systemBoxes.find((c) => c.label === "Corbeille")?.name ||
          "[Gmail]/Trash"
        );
      return (
        systemBoxes.find((c) => c.label === "Brouillons")?.name ||
        "[Gmail]/Drafts"
      );
    })();
    selectedMailboxName = mailboxName;

    const folderKey = (() => {
      if (box === "inbox") return "INBOX";
      if (box === "spam") return "[Gmail]/Spam";
      if (box === "trash") return "[Gmail]/Trash";
      return "DRAFTS";
    })();

    const spaceEmailsByFolder = (spaceEmails as any)?.[resolvedSpaceId] || {};
    const emailIdsInBox = spaceEmailsByFolder[folderKey] || [];

    // List first so we can use threadMemberIds to mark the whole conversation as read.
    let allBoxEmails = await listMailboxThreads(mailboxName, 100);

    const markOneAsSeen = async (id: string) => {
      try {
        const selectedRow = allBoxEmails.find((m) => m.id === id);
        const members = Array.isArray((selectedRow as any)?.threadMemberIds)
          ? (((selectedRow as any).threadMemberIds as unknown[]) || [])
              .filter((x) => typeof x === "string")
              .map((x) => x as string)
          : [];

        // Prefer marking the entire thread as seen when the server supports THREADID/X-GM-THRID.
        try {
          await markThreadAsSeen(id, mailboxName);
        } catch {
          // ignore
        }

        await markMessagesAsSeen([id, ...members], mailboxName);
      } catch {
        // ignore
      }
    };

    if (primaryEmailId) await markOneAsSeen(primaryEmailId);
    if (secondaryEmailId) await markOneAsSeen(secondaryEmailId);

    if (primaryEmailId || secondaryEmailId) {
      // Re-list so unread pills update immediately.
      allBoxEmails = await listMailboxThreads(mailboxName, 100);
    }

    if (q) {
      // Global search: ignore space filtering and search across all spaces.
      emailList = allBoxEmails;
    } else if (resolvedSpaceId === "principal") {
      emailList = allBoxEmails;
    } else {
      emailList = allBoxEmails.filter((msg) => {
        if (emailIdsInBox.includes(msg.id)) return true;
        const members = Array.isArray((msg as any).threadMemberIds)
          ? ((msg as any).threadMemberIds as string[])
          : [];
        return members.some((id) => emailIdsInBox.includes(id));
      });
    }

    if (q) {
      const needle = q.toLocaleLowerCase();
      emailList = emailList.filter((msg) => {
        const hay =
          `${msg.from || ""} ${msg.subject || ""}`.toLocaleLowerCase();
        return hay.includes(needle);
      });
    }

    // If an email is selected, fetch its full content (and thread if available)
    const fetchOne = async (id: string) => {
      if (!id || !id.trim() || id === "undefined" || id === "null") {
        return { email: null, thread: null as any };
      }
      try {
        const thread = await getThreadMessages(id, mailboxName);
        const email =
          thread && thread.length ? thread[thread.length - 1] : null;
        return { email, thread };
      } catch (e) {
        console.error("Error fetching email details:", e);
        try {
          const email = await getMessage(id, mailboxName);
          return { email, thread: null as any };
        } catch {
          return { email: null, thread: null as any };
        }
      }
    };

    if (primaryEmailId) {
      const res = await fetchOne(primaryEmailId);
      selectedEmail = res.email;
      selectedThread = res.thread;
      meEmail = mail.address;

      // Defensive: never leave the reading pane blank if we have an id.
      if (!selectedEmail) {
        try {
          selectedEmail = await getMessage(primaryEmailId, mailboxName);
        } catch {
          // ignore
        }
      }
    }

    if (secondaryEmailId) {
      const res2 = await fetchOne(secondaryEmailId);
      selectedEmail2 = res2.email;
      selectedThread2 = res2.thread;
      meEmail = mail.address;

      if (!selectedEmail2) {
        try {
          selectedEmail2 = await getMessage(secondaryEmailId, mailboxName);
        } catch {
          // ignore
        }
      }
    }
  } catch (e) {
    const errorObj = e as any;
    errorMsg =
      typeof errorObj?.message === "string"
        ? errorObj.message
        : typeof errorObj?.err?.message === "string"
          ? errorObj.err.message
          : String(errorObj) || "Impossible de lire les emails";
    console.error("[mail/page] error:", errorMsg, "full error:", errorObj);
  }

  const activityBySpaceId: Record<string, boolean> = Object.fromEntries(
    (spaces || []).map((s) => {
      const inboxCount = (spaceEmails as any)?.[s.id]?.INBOX?.length ?? 0;
      return [s.id, inboxCount > 0];
    }),
  );

  const bg = (currentSpace as any).appBackground as UiBackground | undefined;
  const mailBgStyle: CSSProperties | undefined = (() => {
    if (!bg) return undefined;
    if (bg.kind === "solid") return { backgroundColor: bg.color };
    const angle = Number.isFinite(bg.angle) ? bg.angle : 135;
    return {
      backgroundImage: `linear-gradient(${angle}deg, ${bg.from}, ${bg.to})`,
    };
  })();

  const accentColor = currentSpace.color || "#0EA5E9";
  const columnBgStyle: CSSProperties | undefined = (() => {
    const bg = (currentSpace as any).columnBackground as
      | UiBackground
      | undefined;
    if (bg) {
      if (bg.kind === "solid") {
        return { backgroundColor: hexToRgba(bg.color, 0.55) };
      }
      const angle = Number.isFinite(bg.angle) ? bg.angle : 135;
      return {
        backgroundImage: `linear-gradient(${angle}deg, ${hexToRgba(bg.from, 0.55)}, ${hexToRgba(bg.to, 0.55)})`,
      };
    }

    if (currentSpace.columnBgColor) {
      return { backgroundColor: hexToRgba(currentSpace.columnBgColor, 0.55) };
    }
    return undefined;
  })();

  const buttonBgColor = (currentSpace as any).buttonBgColor as
    | string
    | undefined;
  const mailFontSize =
    typeof (currentSpace as any).mailFontSize === "number"
      ? ((currentSpace as any).mailFontSize as number)
      : undefined;

  return (
    <div className="min-h-screen bg-transparent">
      {mailBgStyle ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[-15]"
          style={mailBgStyle}
        />
      ) : null}

      <MailGlobalSearch emails={emailList} />

      <MailColumns
        language={language}
        spaces={spaces}
        currentSpaceId={resolvedSpaceId}
        activityBySpaceId={activityBySpaceId}
        emails={emailList as any}
        spaceName={currentSpace.name}
        accentColor={accentColor}
        columnBgStyle={columnBgStyle}
        textColor={currentSpace.textColor}
        buttonBgColor={buttonBgColor}
        mailFontSize={mailFontSize}
        errorMsg={errorMsg}
        selectedEmailId={primaryEmailId}
        selectedEmail={selectedEmail as any}
        selectedThread={selectedThread as any}
        selectedEmailId2={secondaryEmailId}
        selectedEmail2={selectedEmail2 as any}
        selectedThread2={selectedThread2 as any}
        meEmail={meEmail}
        mailboxName={selectedMailboxName}
        space={currentSpace as any}
      />
    </div>
  );
}
