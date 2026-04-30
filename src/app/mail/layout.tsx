import MailColumns from "@/app/mail/_columns";
import { getMailboxes, listMailboxThreads } from "@/lib/gmail";
import { getSession, ensureDefaultSpace } from "@/lib/session";
import type { ReactNode } from "react";
import { normalizeAppLanguage, t } from "@/lib/i18n";
import { readSpaces, readUiSettings } from "@/lib/persist";

type Props = {
  children: ReactNode;
  params?: Record<string, string>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function MailLayout({ children, searchParams }: Props) {
  const session = await getSession();
  ensureDefaultSpace(session);
  const ui = await readUiSettings(session);
  const language = normalizeAppLanguage(ui.language);

  const sp = (searchParams as any) ?? {};

  const spaceId = typeof sp.space === "string" ? sp.space : "principal";
  const selectedEmailId = typeof sp.email === "string" ? sp.email : undefined;
  const selectedEmailId2Raw =
    typeof sp.email2 === "string" ? sp.email2 : undefined;
  const selectedEmailId2 =
    selectedEmailId2Raw && selectedEmailId2Raw !== selectedEmailId
      ? selectedEmailId2Raw
      : undefined;
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

  // List emails for the left pane
  let allBoxEmails = await listMailboxThreads(mailboxName, 100);

  let emailList = allBoxEmails;
  if (q) {
    const needle = q.toLocaleLowerCase();
    emailList = emailList.filter((msg) => {
      const hay = `${msg.from || ""} ${msg.subject || ""}`.toLocaleLowerCase();
      return hay.includes(needle);
    });
  }

  const activityBySpaceId: Record<string, boolean> = Object.fromEntries(
    (spaces || []).map((s) => {
      const inboxCount = (spaceEmails as any)?.[s.id]?.INBOX?.length ?? 0;
      return [s.id, inboxCount > 0];
    }),
  );

  const accentColor = spaces.find((s) => s.id === spaceId)?.color || "#0EA5E9";

  return (
    <div className="min-h-screen bg-transparent">
      <MailColumns
        language={language}
        spaces={spaces}
        currentSpaceId={spaceId}
        activityBySpaceId={activityBySpaceId}
        emails={emailList}
        spaceName={spaces.find((s) => s.id === spaceId)?.name || ""}
        accentColor={accentColor}
        columnBgStyle={undefined}
        textColor={undefined}
        buttonBgColor={undefined}
        mailFontSize={undefined}
        errorMsg={undefined}
        selectedEmailId={selectedEmailId}
        selectedEmailId2={selectedEmailId2}
        meEmail={undefined}
        mailboxName={mailboxName}
        space={spaces.find((s) => s.id === spaceId) as any}
      >
        {children}
      </MailColumns>
    </div>
  );
}
