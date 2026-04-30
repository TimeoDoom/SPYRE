"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { SpaceIcon } from "./SpaceIcon";
import { PrefetchEmail } from "./PrefetchEmail";
import type { Space } from "@/lib/session";
import RichTextEditor from "./RichTextEditor";
import { useLanguage } from "@/app/components/LanguageProvider";
import { t } from "@/lib/i18n";

type Contact = {
  email: string;
  favorite?: boolean;
  avatarUrl?: string;
  createdAt?: number;
};

interface EmailListSidebarProps {
  emails: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    threadCount?: number;
    threadHasReply?: boolean;
    threadUnreadCount?: number;
    threadMemberIds?: string[];
  }>;
  embedded?: boolean;
  spaceName?: string;
  accentColor?: string;
  columnBgStyle?: CSSProperties;
  textColor?: string;
  buttonBgColor?: string;
  mailFontSize?: number;
}

export default function EmailListSidebar({
  emails,
  embedded,
  spaceName: _spaceName,
  accentColor: _accentColor = "#0EA5E9",
  columnBgStyle,
  textColor: _textColor,
  buttonBgColor: _buttonBgColor,
  mailFontSize,
}: EmailListSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = useLanguage();
  const currentSpaceId = searchParams.get("space") || "principal";
  const currentEmailId = searchParams.get("email");
  const currentEmailId2 = searchParams.get("email2");
  const currentBox = searchParams.get("box") || "inbox";
  const currentQuery = searchParams.get("q") || "";

  const buildMailHref = (emailId?: string | null, emailId2?: string | null) => {
    const base = `/mail?space=${encodeURIComponent(currentSpaceId)}&box=${encodeURIComponent(currentBox)}${currentQuery ? `&q=${encodeURIComponent(currentQuery)}` : ""}`;
    const p = emailId ? `&email=${encodeURIComponent(emailId)}` : "";
    const s = emailId2 ? `&email2=${encodeURIComponent(emailId2)}` : "";
    return `${base}${p}${s}`;
  };

  const ui = useMemo(() => {
    if (language === "en") {
      return {
        favorites: "Favorites",
        boxInbox: "Inbox",
        boxDrafts: "Drafts",
        boxSpam: "Spam",
        boxTrash: "Trash",
        close: "Close",
        newMessage: "New message",
        spacePrefix: "Space: ",
        to: "To",
        cc: "Cc",
        subject: "Subject",
        optional: "(optional)",
        message: "Message",
        messagePlaceholder: "Your message…",
        attachments: "Attachments",
        removeAll: "Remove all",
        remove: "Remove",
        attachment: "Attachment",
        noFile: "No files",
        filesAdded: (n: number) => `${n} file${n > 1 ? "s" : ""} added`,
        filesSelected: (n: number) => `${n} file${n > 1 ? "s" : ""} selected`,
        cancel: "Cancel",
        saveDraft: "Save draft",
        sending: "Sending…",
        send: "Send",
        errorSend: "Send failed",
        errorNoAttachmentReceived: "The server did not receive any attachment.",
        sentWithAttachments: (n: number) =>
          `Email sent${n ? ` with ${n} attachment${n > 1 ? "s" : ""}` : ""}`,
        noEmailsTitle: "No emails",
        noEmailsSubtitle: "Nothing to show for this Space.",
        favoriteAdd: "Add to favorites",
        favoriteRemove: "Remove from favorites",
        noticeAttachmentRemoved: "Attachment removed",
        noticeAttachmentsRemoved: "Attachments removed",
        noticeDraftSaved: "Draft saved",
        errorDraftSave: "Could not save draft",
        errorNoRecipient: "Add at least one recipient",
        errorMultipleRecipients: "Only one recipient is supported for now",
        errorEmptyMessage: "Write a message or add an attachment",
        write: "Write",
        writeAria: "Write a message",
        archive: "Archive",
        delete: "Delete",
        spam: "Mark as spam",
        moveTo: "Move to...",
        moveTitle: "MOVE TO",
      } as const;
    }
    return {
      favorites: "Favoris",
      boxInbox: "Réception",
      boxDrafts: "Brouillons",
      boxSpam: "Spam",
      boxTrash: "Corbeille",
      close: "Fermer",
      newMessage: "Nouveau message",
      spacePrefix: "Space: ",
      to: "À",
      cc: "Cc",
      subject: "Sujet",
      optional: "(optionnel)",
      message: "Message",
      messagePlaceholder: "Votre message…",
      attachments: "Pièces jointes",
      removeAll: "Retirer tout",
      remove: "Retirer",
      attachment: "Pièce jointe",
      noFile: "Aucun fichier",
      filesAdded: (n: number) =>
        `${n} fichier${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`,
      filesSelected: (n: number) =>
        `${n} fichier${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}`,
      cancel: "Annuler",
      saveDraft: "Enregistrer brouillon",
      sending: "Envoi…",
      send: "Envoyer",
      errorSend: "Envoi impossible",
      errorNoAttachmentReceived: "Le serveur n'a reçu aucune pièce jointe.",
      sentWithAttachments: (n: number) =>
        `Email envoyé${n ? ` avec ${n} pièce${n > 1 ? "s" : ""} jointe${n > 1 ? "s" : ""}` : ""}`,
      noEmailsTitle: "Aucun email",
      noEmailsSubtitle: "Rien à afficher pour ce Space.",
      favoriteAdd: "Ajouter aux favoris",
      favoriteRemove: "Retirer des favoris",
      noticeAttachmentRemoved: "Pièce jointe retirée",
      noticeAttachmentsRemoved: "Pièces jointes retirées",
      noticeDraftSaved: "Brouillon enregistré",
      errorDraftSave: "Enregistrement du brouillon impossible",
      errorNoRecipient: "Ajoute au moins un destinataire",
      errorMultipleRecipients:
        "Un seul destinataire est supporté pour l'instant",
      errorEmptyMessage: "Écris un message ou ajoute une pièce jointe",
      write: "Écrire",
      writeAria: "Écrire un message",
      archive: "Archiver",
      delete: "Supprimer",
      spam: "Mettre en spam",
      moveTo: "Déplacer vers...",
      moveTitle: "DÉPLACER VERS",
    } as const;
  }, [language]);

  const [isMounted, setIsMounted] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [brokenAvatarEmails, setBrokenAvatarEmails] = useState<
    Record<string, boolean>
  >({});
  const [isSending, setIsSending] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeNotice, setComposeNotice] = useState("");
  const [, setDraftIsSaved] = useState(false);
  const [composeToRecipients, setComposeToRecipients] = useState<
    Array<{ email: string; name?: string }>
  >([]);
  const [composeToDraft, setComposeToDraft] = useState("");
  const [composeCcRecipients, setComposeCcRecipients] = useState<
    Array<{ email: string; name?: string }>
  >([]);
  const [composeCcDraft, setComposeCcDraft] = useState("");
  const [composeBccRecipients, setComposeBccRecipients] = useState<
    Array<{ email: string; name?: string }>
  >([]);
  const [composeBccDraft, setComposeBccDraft] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState<{
    html: string;
    text: string;
  }>({
    html: "",
    text: "",
  });
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [showTextFormatting, setShowTextFormatting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showSpacesMenuId, setShowSpacesMenuId] = useState<string | null>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const bccInputRef = useRef<HTMLInputElement>(null);
  const composeFileRef = useRef<HTMLInputElement>(null);

  const favoriteContacts = useMemo(
    () => contacts.filter((c) => c.favorite),
    [contacts],
  );

  const markAvatarBroken = (emailKey: string) => {
    setBrokenAvatarEmails((prev) => ({ ...prev, [emailKey]: true }));
  };

  const extractAddress = (rawFrom: string): string => {
    const m = (rawFrom || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return (m?.[0] || "").trim().toLowerCase();
  };

  const toggleFavoriteSender = async (from: string) => {
    const senderEmail = extractAddress(from);
    if (!senderEmail) return;
    const current = contacts.find((c) => c.email === senderEmail);
    const nextFavorite = !Boolean(current?.favorite);
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: senderEmail, favorite: nextFavorite }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok || !data?.ok) {
        setComposeError(
          typeof data?.error === "string" ? data.error : ui.errorSend,
        );
        return;
      }
      setContacts(Array.isArray(data.contacts) ? data.contacts : contacts);
      window.dispatchEvent(new CustomEvent("mailapp:contacts-changed"));
    } catch {
      setComposeError(ui.errorSend);
    }
  };

  const addRecipient = (email: string, type: "to" | "cc" | "bcc") => {
    if (!email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return;

    const recipient = { email: email.trim() };

    if (type === "to") {
      if (!composeToRecipients.some((r) => r.email === recipient.email)) {
        setComposeToRecipients((prev) => [...prev, recipient]);
      }
      setComposeToDraft("");
    } else if (type === "cc") {
      if (!composeCcRecipients.some((r) => r.email === recipient.email)) {
        setComposeCcRecipients((prev) => [...prev, recipient]);
      }
      setComposeCcDraft("");
    } else if (type === "bcc") {
      if (!composeBccRecipients.some((r) => r.email === recipient.email)) {
        setComposeBccRecipients((prev) => [...prev, recipient]);
      }
      setComposeBccDraft("");
    }
    setDraftIsSaved(false);
  };

  const removeRecipient = (email: string, type: "to" | "cc" | "bcc") => {
    if (type === "to") {
      setComposeToRecipients((prev) => prev.filter((r) => r.email !== email));
    } else if (type === "cc") {
      setComposeCcRecipients((prev) => prev.filter((r) => r.email !== email));
    } else if (type === "bcc") {
      setComposeBccRecipients((prev) => prev.filter((r) => r.email !== email));
    }
    setDraftIsSaved(false);
  };

  const composeToContact = (email: string) => {
    setComposeToRecipients([{ email }]);
    setComposeError("");
    setComposeNotice("");
    setDraftIsSaved(false);
    setIsComposeOpen(true);
  };

  useEffect(() => {
    setIsMounted(true);
    const loadContacts = async () => {
      try {
        const res = await fetch("/api/contacts", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        }
      } catch {}
    };

    const loadSpaces = async () => {
      try {
        const res = await fetch("/api/spaces", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSpaces(data.spaces || []);
        }
      } catch {}
    };

    const onContactsChanged = () => loadContacts();
    const onSpacesChanged = () => loadSpaces();

    loadContacts();
    loadSpaces();
    window.addEventListener("mailapp:contacts-changed", onContactsChanged);
    window.addEventListener("mailapp:spaces-changed", onSpacesChanged);
    return () => {
      window.removeEventListener("mailapp:contacts-changed", onContactsChanged);
      window.removeEventListener("mailapp:spaces-changed", onSpacesChanged);
    };
  }, []);

  const formatFileSize = (size: number) => {
    if (!Number.isFinite(size) || size <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let val = size;
    let i = 0;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i += 1;
    }
    const digits = i === 0 ? 0 : i === 1 ? 0 : 1;
    return `${val.toFixed(digits)} ${units[i]}`;
  };

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("mailapp:open-search"));
  };

  const handleAttachFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files);
    setComposeAttachments((prev) => [...prev, ...next]);
    setComposeNotice(ui.filesAdded(next.length));
    setComposeError("");
  };

  const handleRemoveAttachment = (index: number) => {
    setComposeAttachments((prev) => {
      const next = prev.slice();
      next.splice(index, 1);
      return next;
    });
    setComposeNotice(ui.noticeAttachmentRemoved);
  };

  const handleRemoveAllAttachments = () => {
    setComposeAttachments([]);
    setComposeNotice(ui.noticeAttachmentsRemoved);
  };

  const handleSend = async () => {
    if (isSending) return;
    setComposeError("");
    setComposeNotice("");

    const toList = composeToRecipients.map((r) => r.email).filter(Boolean);
    if (toList.length === 0) {
      setComposeError(ui.errorNoRecipient);
      return;
    }
    if (toList.length > 1) {
      setComposeError(ui.errorMultipleRecipients);
      return;
    }

    const ccList = composeCcRecipients.map((r) => r.email).filter(Boolean);
    const bccList = composeBccRecipients.map((r) => r.email).filter(Boolean);
    const bodyText = composeMessage.text.trim();
    const bodyHtml = composeMessage.html.trim();
    const hasAttachments = composeAttachments.length > 0;

    if (!bodyText && !hasAttachments) {
      setComposeError(ui.errorEmptyMessage);
      return;
    }

    setIsSending(true);
    try {
      if (hasAttachments) {
        const formData = new FormData();
        formData.append("to", toList[0]);
        if (ccList.length) formData.append("cc", ccList.join(", "));
        if (bccList.length) formData.append("bcc", bccList.join(", "));
        if (composeSubject.trim())
          formData.append("subject", composeSubject.trim());
        formData.append("body", bodyText);
        if (bodyHtml) formData.append("bodyHtml", bodyHtml);
        composeAttachments.forEach((f) => formData.append("files", f));

        const res = await fetch("/api/mail/send", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || ui.errorSend);
        }

        alert(ui.sentWithAttachments(composeAttachments.length));
      } else {
        const res = await fetch("/api/mail/send", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            to: toList[0],
            cc: ccList.join(", "),
            bcc: bccList.join(", "),
            subject: composeSubject.trim(),
            body: bodyText,
            bodyHtml: bodyHtml || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || ui.errorSend);
        }
      }

      setComposeToRecipients([]);
      setComposeCcRecipients([]);
      setComposeBccRecipients([]);
      setComposeToDraft("");
      setComposeCcDraft("");
      setComposeBccDraft("");
      setComposeSubject("");
      setComposeMessage({ html: "", text: "" });
      setComposeAttachments([]);
      setIsComposeOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.errorSend;
      setComposeError(msg || ui.errorSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleAction = async (
    action: "archive" | "delete" | "spam" | "space",
    emailId: string,
    targetSpaceId?: string,
  ) => {
    setOpenMenuId(null);
    try {
      let endpoint = "";
      let body: any = { id: emailId, box: currentBox, spaceId: currentSpaceId };

      if (action === "archive") endpoint = "/api/mail/archive";
      else if (action === "delete") endpoint = "/api/mail/delete";
      else if (action === "spam") endpoint = "/api/mail/spam";
      else if (action === "space") {
        if (!targetSpaceId) return;

        // Add to target space
        endpoint = `/api/spaces/${encodeURIComponent(targetSpaceId)}/add-email`;
        body = { emailId };

        // If we are currently in a space (not principal), also remove from current space
        if (currentSpaceId && currentSpaceId !== "principal") {
          await fetch(
            `/api/spaces/${encodeURIComponent(currentSpaceId)}/remove-email`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ emailId }),
            },
          );
        }
      }

      if (!endpoint) return;

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Action failed");
      }
    } catch (e) {
      alert("Action failed");
    }
  };

  if (embedded) {
    return (
      <div style={{ height: "100%", minWidth: 0, flex: 1, overflow: "auto" }}>
        <div style={{ padding: "12px 0" }}>
          {emails.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{ui.noEmailsTitle}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {ui.noEmailsSubtitle}
              </div>
            </div>
          ) : (
            emails.map((email) => (
              <Link
                key={email.id}
                href={buildMailHref(email.id, null)}
                prefetch={false}
                className={`email-item${currentEmailId === email.id || currentEmailId2 === email.id ? " active" : ""}`}
              >
                <div className="email-item-avatar">
                  <div className="email-item-avatar-placeholder">
                    {(email.from || "?")[0].toUpperCase()}
                  </div>
                </div>
                <div className="email-item-sender">{email.from}</div>
                <div className="email-item-subject">
                  {email.subject || ui.noEmailsTitle}
                </div>
                <div className="email-item-snippet">{email.snippet}</div>
                <div className="email-item-date">{email.date}</div>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="email-list-sidebar" style={columnBgStyle}>
      {favoriteContacts.length > 0 && (
        <div className="email-list-favorites">
          {favoriteContacts.slice(0, 12).map((c) => {
            const emailKey = (c.email || "").trim().toLowerCase();
            const canShowAvatar =
              typeof c.avatarUrl === "string" &&
              c.avatarUrl.trim().length > 0 &&
              !brokenAvatarEmails[emailKey];
            return (
              <button
                key={c.email}
                type="button"
                className="email-list-favorite-item"
                onClick={() => composeToContact(c.email)}
              >
                <div className="email-list-favorite-avatar">
                  {canShowAvatar ? (
                    <img
                      src={c.avatarUrl!.trim()}
                      alt=""
                      onError={() => markAvatarBroken(emailKey)}
                    />
                  ) : (
                    <div className="email-list-favorite-avatar-placeholder">
                      {(c.email.split("@")[0] || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="email-list-favorite-name">
                  {c.email.split("@")[0].slice(0, 9)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="email-list-search">
        <button
          type="button"
          className="email-list-write-button"
          onClick={() => {
            setComposeError("");
            setComposeNotice("");
            setDraftIsSaved(false);
            setIsComposeOpen(true);
          }}
          disabled={isSending}
        >
          <svg viewBox="0 0 18 18" fill="none">
            <path
              d="M17.14.86a2.84 2.84 0 00-3.843 0L1.099 13.06a4.65 4.65 0 00-.815 1.216c-.189.455-.285.943-.284 1.435V17.25a.75.75 0 00.75.75h1.54a4.67 4.67 0 002.65-1.098L17.14 4.703a2.844 2.844 0 000-3.843zm-13.26 14.98a3.18 3.18 0 00-1.59.659H1.5v-.79a3.17 3.17 0 00.659-1.59l9.258-9.258 1.725 1.725L3.88 15.842zm12.198-12.199L14.2 5.523l-1.725-1.721 1.88-1.88a1.34 1.34 0 011.722 0c.113.113.203.248.264.395.061.148.092.307.092.467 0 .16-.032.318-.093.466a1.33 1.33 0 01-.264.395z"
              fill="#6D6D6D"
            />
          </svg>
          {ui.write}
        </button>
        <button className="email-list-search-button" onClick={openSearch}>
          <svg viewBox="0 0 18 18" fill="none">
            <path
              d="M17.78 16.72l-4.477-4.477a7.44 7.44 0 001.676-5.318 7.47 7.47 0 00-2.451-5.008A7.48 7.48 0 007.3-.021a7.48 7.48 0 00-5.124 2.198A7.48 7.48 0 00-.022 7.3a7.48 7.48 0 001.939 5.228 7.48 7.48 0 005.008 2.451 7.44 7.44 0 005.318-1.676l4.477 4.477a.75.75 0 001.06-1.06zM7.5 13.5A6 6 0 117.5 1.5a6 6 0 010 12z"
              fill="#6D6D6D"
            />
          </svg>
        </button>
      </div>

      <div className="email-list-tabs">
        {(["inbox", "drafts", "spam", "trash"] as const).map((key) => {
          const labelMap: Record<string, string> = {
            inbox: ui.boxInbox,
            drafts: ui.boxDrafts,
            spam: ui.boxSpam,
            trash: ui.boxTrash,
          };
          const isActive = currentBox === key;
          return (
            <Link
              key={key}
              href={`/mail?space=${encodeURIComponent(currentSpaceId)}&box=${encodeURIComponent(key)}${currentQuery ? `&q=${encodeURIComponent(currentQuery)}` : ""}`}
              prefetch={false}
              className={`email-list-tab${isActive ? " active" : ""}`}
            >
              {labelMap[key]}
            </Link>
          );
        })}
      </div>

      <div className="email-list-emails">
        {emails.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            <div style={{ fontWeight: 500 }}>{ui.noEmailsTitle}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {ui.noEmailsSubtitle}
            </div>
          </div>
        ) : (
          emails.map((email) => {
            const isActive =
              currentEmailId === email.id || currentEmailId2 === email.id;
            const threadUnreadCount =
              typeof (email as any).threadUnreadCount === "number"
                ? Math.max(0, Math.floor((email as any).threadUnreadCount))
                : 0;
            const showUnreadBadge = threadUnreadCount > 0;
            return (
              <div key={email.id} style={{ position: "relative" }}>
                <PrefetchEmail emailId={email.id} mailbox="INBOX">
                  <Link
                    href={buildMailHref(email.id, null)}
                    prefetch={false}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-mailapp-email-id",
                        email.id,
                      );
                      e.dataTransfer.setData("text/plain", email.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={`email-item${isActive ? " active" : ""}`}
                  >
                  <div className="email-item-avatar">
                    {(() => {
                      const fromEmail = (email.from || "").includes("<")
                        ? (email.from || "")
                            .split("<")[1]
                            .replace(">", "")
                            .trim()
                        : (email.from || "").trim();
                      const contact = contacts.find(
                        (c) =>
                          c.email.toLowerCase() === fromEmail.toLowerCase(),
                      );
                      if (contact?.avatarUrl) {
                        return <img src={contact.avatarUrl} alt="" />;
                      }
                      return (
                        <div className="email-item-avatar-placeholder">
                          {(email.from || "?")[0].toUpperCase()}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="email-item-content">
                    <div className="email-item-header">
                      <span className="email-item-sender">
                        {(email.from || "").includes("<")
                          ? (email.from || "")
                              .split("<")[0]
                              .trim()
                              .replace(/^"|"$/g, "")
                          : (email.from || "").split("@")[0]}
                      </span>
                      <div
                        className="email-item-header-actions"
                        style={{ position: "relative" }}
                      >
                        <button
                          type="button"
                          className="email-item-dots-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(
                              openMenuId === email.id ? null : email.id,
                            );
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="19" cy="12" r="1" />
                            <circle cx="5" cy="12" r="1" />
                          </svg>
                        </button>
                        {showUnreadBadge && (
                          <div className="email-item-unread-badge">
                            {threadUnreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="email-item-subject"
                      style={{
                        fontWeight: 700,
                        ...(mailFontSize
                          ? { fontSize: `${mailFontSize}px` }
                          : {}),
                      }}
                    >
                      {email.subject || t(language, "mail.noSubject")}
                    </div>
                    <div className="email-item-snippet">{email.snippet}</div>
                    <div className="email-item-footer">
                      <span className="email-item-date">{email.date}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="email-item-favorite-toggle"
                        style={{
                          color: contacts.find(
                            (c) => c.email === extractAddress(email.from),
                          )?.favorite
                            ? "#f59e0b"
                            : "#d1d5db",
                          fontSize: "20px",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleFavoriteSender(email.from);
                        }}
                      >
                        {contacts.find(
                          (c) => c.email === extractAddress(email.from),
                        )?.favorite
                          ? <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="#f59e0b"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                          : <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>}
                      </span>
                    </div>
                  </div>
                </Link>
                </PrefetchEmail>

                {openMenuId === email.id && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 100 }}
                      onClick={() => {
                        setOpenMenuId(null);
                        setShowSpacesMenuId(null);
                      }}
                    />
                    <div
                      className="email-item-menu"
                      style={{
                        position: "absolute",
                        top: "40px",
                        right: "10px",
                        background: "white",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        zIndex: 101,
                        border: "1px solid #f1f5f9",
                        padding: "8px",
                        minWidth: "160px",
                      }}
                    >
                      <button
                        className="email-menu-item"
                        onClick={() => handleAction("archive", email.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="21 8 21 21 3 21 3 8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                          {ui.archive}
                        </div>
                      </button>
                      <button
                        className="email-menu-item"
                        onClick={() => handleAction("delete", email.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "#ef4444",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M17.5 3.33333H14.9166C14.7232 2.39284 14.2115 1.54779 13.4677 0.940598C12.7239 0.333408 11.7935 0.0012121 10.8333 0L9.16663 0C8.20645 0.0012121 7.27606 0.333408 6.53225 0.940598C5.78844 1.54779 5.27671 2.39284 5.08329 3.33333H2.49996C2.27895 3.33333 2.06698 3.42113 1.9107 3.57741C1.75442 3.73369 1.66663 3.94565 1.66663 4.16667C1.66663 4.38768 1.75442 4.59964 1.9107 4.75592C2.06698 4.9122 2.27895 5 2.49996 5H3.33329V15.8333C3.33462 16.938 3.77403 17.997 4.55514 18.7782C5.33626 19.5593 6.3953 19.9987 7.49996 20H12.5C13.6046 19.9987 14.6637 19.5593 15.4448 18.7782C16.2259 17.997 16.6653 16.938 16.6666 15.8333V5H17.5C17.721 5 17.9329 4.9122 18.0892 4.75592C18.2455 4.59964 18.3333 4.38768 18.3333 4.16667C18.3333 3.94565 18.2455 3.73369 18.0892 3.57741C17.9329 3.42113 17.721 3.33333 17.5 3.33333ZM9.16663 1.66667H10.8333C11.3502 1.6673 11.8542 1.82781 12.2763 2.1262C12.6984 2.42459 13.0178 2.84624 13.1908 3.33333H6.80913C6.98211 2.84624 7.30154 2.42459 7.72361 2.1262C8.14569 1.82781 8.64973 1.6673 9.16663 1.66667ZM15 15.8333C15 16.4964 14.7366 17.1323 14.2677 17.6011C13.7989 18.0699 13.163 18.3333 12.5 18.3333H7.49996C6.83692 18.3333 6.20103 18.0699 5.73219 17.6011C5.26335 17.1323 4.99996 16.4964 4.99996 15.8333V5H15V15.8333Z"
                              fill="currentColor"
                            />
                          </svg>
                          {ui.delete}
                        </div>
                      </button>
                      <button
                        className="email-menu-item"
                        onClick={() => handleAction("spam", email.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line
                              x1="4.93"
                              y1="4.93"
                              x2="19.07"
                              y2="19.07"
                            ></line>
                          </svg>
                          {ui.spam}
                        </div>
                      </button>
                      <div
                        style={{
                          height: "1px",
                          background: "#f1f5f9",
                          margin: "4px 0",
                        }}
                      />

                      {!showSpacesMenuId ? (
                        <button
                          className="email-menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSpacesMenuId(email.id);
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              justifyContent: "space-between",
                              width: "100%",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                              </svg>
                              {ui.moveTo}
                            </div>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          </div>
                        </button>
                      ) : (
                        <div className="email-item-spaces-list">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "4px 8px",
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSpacesMenuId(null);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                color: "#94a3b8",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="15 18 9 12 15 6"></polyline>
                              </svg>
                            </button>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#94a3b8",
                                fontWeight: 600,
                              }}
                            >
                              {ui.moveTitle}
                            </span>
                          </div>
                          {spaces.map((s) => (
                            <button
                              key={s.id}
                              className="email-menu-item"
                              onClick={() =>
                                handleAction("space", email.id, s.id)
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <SpaceIcon space={s} size={14} />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {isMounted && isComposeOpen && !embedded
        ? createPortal(
            <div className="compose-overlay">
              <button
                type="button"
                className="compose-backdrop"
                aria-label={ui.close}
                onClick={() => setIsComposeOpen(false)}
              />
              <div className="compose-modal">
                <div className="compose-scrollable-section">
                  {(composeError || composeNotice) && (
                    <div className="compose-banner">
                      {composeError ? (
                        <span className="compose-banner-error">
                          {composeError}
                        </span>
                      ) : (
                        <span className="compose-banner-notice">
                          {composeNotice}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="compose-fields-section">
                    {/* Header with To field */}
                    <div className="compose-header">
                      <div className="compose-to-container">
                        <span className="compose-to-label">To :</span>
                        <div className="compose-recipients-wrapper">
                          {composeToRecipients.map((recipient) => {
                            const contact = contacts.find(
                              (c) => c.email === recipient.email,
                            );
                            return (
                              <div
                                key={recipient.email}
                                className="compose-recipient-chip"
                              >
                                <div className="compose-recipient-avatar">
                                  {contact?.avatarUrl ? (
                                    <img src={contact.avatarUrl} alt="" />
                                  ) : (
                                    <div className="email-item-avatar-placeholder">
                                      {recipient.email[0].toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <span>{recipient.email}</span>
                                <button
                                  onClick={() =>
                                    removeRecipient(recipient.email, "to")
                                  }
                                  className="compose-recipient-remove"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                          <input
                            ref={toInputRef}
                            type="email"
                            value={composeToDraft}
                            onChange={(e) => {
                              setComposeToDraft(e.target.value);
                              setDraftIsSaved(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addRecipient(composeToDraft, "to");
                              }
                            }}
                            onBlur={() => {
                              if (composeToDraft.trim()) {
                                addRecipient(composeToDraft, "to");
                              }
                            }}
                            placeholder=""
                            className="compose-recipient-input"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="compose-header-actions">
                        <button
                          type="button"
                          onClick={() => setShowCc(!showCc)}
                          className="compose-header-action"
                        >
                          Cc
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBcc(!showBcc)}
                          className="compose-header-action"
                        >
                          Bcc
                        </button>
                      </div>
                    </div>

                    {/* Cc field */}
                    {showCc && (
                      <div className="compose-field compose-field-cc">
                        <div className="compose-field-label">Cc :</div>
                        <div className="compose-recipients-wrapper">
                          {composeCcRecipients.map((recipient) => (
                            <div
                              key={recipient.email}
                              className="compose-recipient-chip compose-recipient-chip-secondary"
                            >
                              <span>{recipient.email}</span>
                              <button
                                onClick={() =>
                                  removeRecipient(recipient.email, "cc")
                                }
                                className="compose-recipient-remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <input
                            ref={ccInputRef}
                            type="email"
                            value={composeCcDraft}
                            onChange={(e) => {
                              setComposeCcDraft(e.target.value);
                              setDraftIsSaved(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addRecipient(composeCcDraft, "cc");
                              }
                            }}
                            onBlur={() => {
                              if (composeCcDraft.trim()) {
                                addRecipient(composeCcDraft, "cc");
                              }
                            }}
                            placeholder="recipient@example.com"
                            className="compose-recipient-input"
                          />
                        </div>
                      </div>
                    )}

                    {/* Bcc field */}
                    {showBcc && (
                      <div className="compose-field compose-field-bcc">
                        <div className="compose-field-label">Bcc :</div>
                        <div className="compose-recipients-wrapper">
                          {composeBccRecipients.map((recipient) => (
                            <div
                              key={recipient.email}
                              className="compose-recipient-chip compose-recipient-chip-secondary"
                            >
                              <span>{recipient.email}</span>
                              <button
                                onClick={() =>
                                  removeRecipient(recipient.email, "bcc")
                                }
                                className="compose-recipient-remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <input
                            ref={bccInputRef}
                            type="email"
                            value={composeBccDraft}
                            onChange={(e) => {
                              setComposeBccDraft(e.target.value);
                              setDraftIsSaved(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addRecipient(composeBccDraft, "bcc");
                              }
                            }}
                            onBlur={() => {
                              if (composeBccDraft.trim()) {
                                addRecipient(composeBccDraft, "bcc");
                              }
                            }}
                            placeholder="recipient@example.com"
                            className="compose-recipient-input"
                          />
                        </div>
                      </div>
                    )}

                    {/* Subject field */}
                    <div className="compose-field compose-field-subject">
                      <div className="compose-field-label">Subject :</div>
                      <input
                        type="text"
                        value={composeSubject}
                        onChange={(e) => {
                          setComposeSubject(e.target.value);
                          setDraftIsSaved(false);
                        }}
                        className="compose-subject-input"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                {/* Message body with fixed height */}
                <div className="compose-editor-section">
                  <RichTextEditor
                    value={composeMessage}
                    onChange={(next) => {
                      setDraftIsSaved(false);
                      setComposeMessage(next);
                    }}
                    placeholder={ui.messagePlaceholder}
                    minHeightClassName="min-h-[180px]"
                    showToolbar={showTextFormatting}
                  />
                </div>

                {/* Footer toolbar */}
                <div className="compose-footer">
                  <button
                    type="button"
                    className="compose-delete-btn"
                    title="Delete"
                    onClick={() => setIsComposeOpen(false)}
                    disabled={isSending}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M17.5 3.33333H14.9166C14.7232 2.39284 14.2115 1.54779 13.4677 0.940598C12.7239 0.333408 11.7935 0.0012121 10.8333 0L9.16663 0C8.20645 0.0012121 7.27606 0.333408 6.53225 0.940598C5.78844 1.54779 5.27671 2.39284 5.08329 3.33333H2.49996C2.27895 3.33333 2.06698 3.42113 1.9107 3.57741C1.75442 3.73369 1.66663 3.94565 1.66663 4.16667C1.66663 4.38768 1.75442 4.59964 1.9107 4.75592C2.06698 4.9122 2.27895 5 2.49996 5H3.33329V15.8333C3.33462 16.938 3.77403 17.997 4.55514 18.7782C5.33626 19.5593 6.3953 19.9987 7.49996 20H12.5C13.6046 19.9987 14.6637 19.5593 15.4448 18.7782C16.2259 17.997 16.6653 16.938 16.6666 15.8333V5H17.5C17.721 5 17.9329 4.9122 18.0892 4.75592C18.2455 4.59964 18.3333 4.38768 18.3333 4.16667C18.3333 3.94565 18.2455 3.73369 18.0892 3.57741C17.9329 3.42113 17.721 3.33333 17.5 3.33333ZM9.16663 1.66667H10.8333C11.3502 1.6673 11.8542 1.82781 12.2763 2.1262C12.6984 2.42459 13.0178 2.84624 13.1908 3.33333H6.80913C6.98211 2.84624 7.30154 2.42459 7.72361 2.1262C8.14569 1.82781 8.64973 1.6673 9.16663 1.66667ZM15 15.8333C15 16.4964 14.7366 17.1323 14.2677 17.6011C13.7989 18.0699 13.163 18.3333 12.5 18.3333H7.49996C6.83692 18.3333 6.20103 18.0699 5.73219 17.6011C5.26335 17.1323 4.99996 16.4964 4.99996 15.8333V5H15V15.8333Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  <div className="compose-toolbar">
                    <button
                      type="button"
                      className={`compose-toolbar-btn ${showTextFormatting ? "active" : ""}`}
                      title="Change text style"
                      onClick={() => setShowTextFormatting(!showTextFormatting)}
                      disabled={isSending}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path
                          d="M6.1667 4.62737C6.08981 4.49821 5.98068 4.39124 5.85 4.31696C5.71933 4.24267 5.57159 4.20361 5.42128 4.20361C5.27097 4.20361 5.12323 4.24267 4.99256 4.31696C4.86188 4.39124 4.75275 4.49821 4.67586 4.62737L0.0925291 13.794C0.0426006 13.892 0.0125639 13.9989 0.00415079 14.1086C-0.00426233 14.2183 0.00911457 14.3285 0.0435102 14.433C0.0779059 14.5374 0.13264 14.6341 0.204557 14.7173C0.276473 14.8005 0.36415 14.8686 0.462531 14.9178C0.560912 14.9669 0.668052 14.9962 0.777774 15.0037C0.887495 15.0113 0.997628 14.997 1.10182 14.9618C1.20601 14.9266 1.30221 14.8711 1.38485 14.7986C1.4675 14.726 1.53497 14.6378 1.58336 14.539L3.01586 11.6665H7.8192L9.25586 14.539C9.30426 14.6378 9.37172 14.726 9.45437 14.7986C9.53702 14.8711 9.63321 14.9266 9.7374 14.9618C9.8416 14.997 9.95173 15.0113 10.0615 15.0037C10.1712 14.9962 10.2783 14.9669 10.3767 14.9178C10.4751 14.8686 10.5628 14.8005 10.6347 14.7173C10.7066 14.6341 10.7613 14.5374 10.7957 14.433C10.8301 14.3285 10.8435 14.2183 10.8351 14.1086C10.8267 13.9989 10.7966 13.892 10.7467 13.794L6.1667 4.62737ZM3.8492 9.99987L5.4167 6.8632L6.98586 9.99987H3.8492Z"
                          fill="currentColor"
                        />
                        <path
                          d="M19.1666 6.6665C18.9456 6.6665 18.7336 6.7543 18.5773 6.91058C18.4211 7.06686 18.3333 7.27882 18.3333 7.49984V7.5215C17.6163 6.97 16.7378 6.66957 15.8333 6.6665C14.7282 6.6665 13.6684 7.10549 12.887 7.88689C12.1056 8.66829 11.6666 9.7281 11.6666 10.8332C11.6666 11.9382 12.1056 12.998 12.887 13.7794C13.6684 14.5609 14.7282 14.9998 15.8333 14.9998C16.7378 14.9968 17.6163 14.6963 18.3333 14.1448V14.1665C18.3333 14.3875 18.4211 14.5995 18.5773 14.7558C18.7336 14.912 18.9456 14.9998 19.1666 14.9998C19.3876 14.9998 19.5996 14.912 19.7559 14.7558C19.9121 14.5995 19.9999 14.3875 19.9999 14.1665V7.49984C19.9999 7.27882 19.9121 7.06686 19.7559 6.91058C19.5996 6.7543 19.3876 6.6665 19.1666 6.6665ZM15.8333 13.3332C15.3388 13.3332 14.8555 13.1865 14.4444 12.9118C14.0332 12.6371 13.7128 12.2467 13.5236 11.7899C13.3344 11.3331 13.2849 10.8304 13.3813 10.3454C13.4778 9.86049 13.7159 9.41503 14.0655 9.0654C14.4151 8.71577 14.8606 8.47767 15.3456 8.38121C15.8305 8.28474 16.3332 8.33425 16.79 8.52347C17.2468 8.71269 17.6372 9.03312 17.9119 9.44424C18.1867 9.85537 18.3333 10.3387 18.3333 10.8332C18.3333 11.4962 18.0699 12.1321 17.601 12.6009C17.1322 13.0698 16.4963 13.3332 15.8333 13.3332Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="compose-toolbar-btn"
                      title={ui.attachments}
                      onClick={() => composeFileRef.current?.click()}
                      disabled={isSending}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path
                          d="M19.125 7.99983C18.9687 7.8436 18.7568 7.75584 18.5359 7.75584C18.3149 7.75584 18.103 7.8436 17.9467 7.99983L8.87002 17.1157C8.48311 17.5026 8.02378 17.8096 7.51824 18.019C7.0127 18.2285 6.47085 18.3363 5.92365 18.3363C4.81851 18.3364 3.75861 17.8975 2.9771 17.1161C2.1956 16.3347 1.75651 15.2748 1.75643 14.1697C1.75635 13.0646 2.19529 12.0047 2.97669 11.2232L11.7675 2.3965C12.2376 1.93391 12.8714 1.6758 13.5309 1.67841C14.1904 1.68102 14.8222 1.94412 15.2886 2.41042C15.755 2.87671 16.0183 3.50841 16.021 4.16792C16.0238 4.82743 15.7658 5.46131 15.3034 5.9315L6.51252 14.7582C6.35398 14.91 6.14291 14.9948 5.92335 14.9948C5.7038 14.9948 5.49273 14.91 5.33419 14.7582C5.17796 14.6019 5.0902 14.39 5.0902 14.169C5.0902 13.948 5.17796 13.7361 5.33419 13.5798L13.1609 5.71733C13.3127 5.56016 13.3966 5.34966 13.3947 5.13116C13.3928 4.91266 13.3052 4.70365 13.1507 4.54915C12.9962 4.39464 12.7872 4.307 12.5687 4.3051C12.3502 4.3032 12.1397 4.3872 11.9825 4.539L4.15585 12.4015C3.92366 12.6336 3.73947 12.9093 3.61381 13.2126C3.48815 13.5159 3.42347 13.8411 3.42347 14.1694C3.42347 14.4978 3.48815 14.8229 3.61381 15.1262C3.73947 15.4296 3.92366 15.7052 4.15585 15.9373C4.6322 16.3919 5.26534 16.6455 5.92377 16.6455C6.5822 16.6455 7.21534 16.3919 7.69169 15.9373L16.4817 7.10983C17.2467 6.32508 17.6717 5.27054 17.6647 4.17464C17.6577 3.07874 17.2192 2.02973 16.4442 1.25485C15.6692 0.479968 14.6201 0.0416165 13.5242 0.0347499C12.4283 0.0278832 11.3738 0.453055 10.5892 1.21816L1.79835 10.0448C0.704335 11.1388 0.0897217 12.6227 0.0897217 14.1698C0.0897217 15.717 0.704335 17.2008 1.79835 18.2948C2.89237 19.3888 4.37618 20.0035 5.92335 20.0035C7.47053 20.0035 8.95433 19.3888 10.0484 18.2948L19.125 9.1815C19.2029 9.10406 19.2647 9.01199 19.3068 8.9106C19.349 8.8092 19.3707 8.70047 19.3707 8.59066C19.3707 8.48085 19.349 8.37212 19.3068 8.27073C19.2647 8.16933 19.2029 8.07727 19.125 7.99983Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="compose-send-btn"
                    disabled={isSending}
                    onClick={handleSend}
                  >
                    <span>{isSending ? ui.sending : ui.send}</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>

                {composeAttachments.length > 0 && (
                  <div className="compose-attachments">
                    <div className="compose-attachments-header">
                      <span>{ui.attachments}</span>
                      <button
                        type="button"
                        className="compose-attachments-remove-all"
                        onClick={handleRemoveAllAttachments}
                      >
                        {ui.removeAll}
                      </button>
                    </div>
                    <div
                      className="compose-attachments-list"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        padding: "0 4px",
                      }}
                    >
                      {composeAttachments.map((file, index) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="email-detail-attachment-card"
                          style={{ position: "relative", margin: 0 }}
                        >
                          <div className="email-detail-attachment-icon">
                            <svg
                              width="20"
                              height="24"
                              viewBox="0 0 20 24"
                              fill="none"
                            >
                              <rect
                                x="1"
                                y="1"
                                width="18"
                                height="22"
                                rx="2"
                                stroke="#94a3b8"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M5 7h10M5 11h10M5 15h7"
                                stroke="#94a3b8"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                          <div className="email-detail-attachment-info">
                            <div
                              className="email-detail-attachment-name"
                              style={{
                                maxWidth: "120px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {file.name || ui.attachment}
                            </div>
                            <div className="email-detail-attachment-meta">
                              <span>{formatFileSize(file.size)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="compose-attachment-remove"
                            onClick={() => handleRemoveAttachment(index)}
                            style={{
                              position: "absolute",
                              top: "-8px",
                              right: "-8px",
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              color: "#64748b",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                              padding: 0,
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
      <input
        ref={composeFileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          handleAttachFiles(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
