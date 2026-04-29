"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Space } from "@/lib/session";
import { SpaceIcon } from "./SpaceIcon";
import { useLanguage } from "@/app/components/LanguageProvider";
import RichTextEditor from "@/app/components/RichTextEditor";
import { t } from "@/lib/i18n";

function FormattedTime({ dateString }: { dateString: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const t = Date.parse(dateString);
  if (!Number.isFinite(t)) return <span>{dateString}</span>;

  return (
    <span>
      {new Date(t).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}

type Contact = {
  email: string;
  favorite?: boolean;
  avatarUrl?: string;
  createdAt?: number;
};

interface EmailDetailProps {
  email: {
    id: string;
    mailbox?: string;
    threadId?: string;
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
    senderEmail?: string;
    from: string;
    to?: string;
    cc?: string;
    subject: string;
    date: string;
    dateIso?: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: Array<{
      index: number;
      filename: string;
      contentType?: string;
      size?: number;
      disposition?: string;
      contentId?: string;
    }>;
  };
  emailId: string;
  space: Space;
  thread?: Array<EmailDetailProps["email"]>;
  meEmail?: string;
}

export default function EmailDetail({
  email,
  emailId,
  space,
  thread,
  meEmail,
}: EmailDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = useLanguage();

  const [isHydrated, setIsHydrated] = useState(false);

  const ui = useMemo(() => {
    if (language === "en") {
      return {
        reply: "Reply",
        replyAll: "Reply all",
        forward: "Forward",
        archive: "Archive",
        favorite: "Favorite",
        favoriteTitle: "Add sender to favorites",
        assign: "Assign",
        delete: "Delete",
        noSubject: t(language, "mail.noSubject"),
        cannotDetermineSender: "Could not determine the sender",
        favoriteAddFailed: "Could not add to favorites",
        favoriteAdded: "Added to favorites",
        archiveFailed: "Archive failed",
        archived: "Email archived",
        deleteFailed: "Delete failed",
        deleted: "Email deleted",
        movedToTrash: "Email moved to trash",
        addedToSpace: "Email added to Space",
        addToSpaceFailed: "Could not add email",
        connectionError: "Connection error",
        attachments: "Attachments",
        attachmentFallbackName: "attachment",
        download: "Download",
        noContent: "(no content)",
        quickReplyPlaceholder: "Type a quick reply…",
        send: "Send",
        sending: "Sending…",
        emptyReply: "Write a message first",
        chatMode: "Chat mode",
        emailMode: "Email view",
        openChatToReply: "Reply",
        avatarPick: "Choose a profile photo",
        avatarPicked: "Profile photo updated",
        avatarPickFailed: "Could not update profile photo",
        avatarUnsupported: "Unsupported image type (PNG/JPEG/WEBP/GIF)",
        avatarTooLarge: "Image too large (max 2MB)",
        moveTo: "Move to Space",
        moveTitle: "MOVE TO",
      } as const;
    }
    return {
      reply: "Répondre",
      replyAll: "Répondre à tous",
      forward: "Transférer",
      archive: "Archiver",
      favorite: "Favori",
      favoriteTitle: "Ajouter l'expéditeur aux favoris",
      assign: "Assigner",
      delete: "Supprimer",
      noSubject: t(language, "mail.noSubject"),
      cannotDetermineSender: "Impossible de déterminer l'expéditeur",
      favoriteAddFailed: "Ajout aux favoris impossible",
      favoriteAdded: "Ajouté aux favoris",
      archiveFailed: "Archivage impossible",
      archived: "Email archivé",
      deleteFailed: "Suppression impossible",
      deleted: "Email supprimé",
      movedToTrash: "Email déplacé dans la corbeille",
      addedToSpace: "Email ajouté au Space",
      addToSpaceFailed: "Erreur lors de l'ajout",
      connectionError: "Erreur de connexion",
      attachments: "Pièces jointes",
      attachmentFallbackName: "piece-jointe",
      download: "Télécharger",
      noContent: "(pas de contenu)",
      quickReplyPlaceholder: "Rédiger une réponse rapide…",
      send: "Envoyer",
      sending: "Envoi…",
      emptyReply: "Écris un message avant d'envoyer",
      chatMode: "Mode chat",
      emailMode: "Vue email",
      openChatToReply: "Répondre",
      avatarPick: "Choisir une photo de profil",
      avatarPicked: "Photo de profil mise à jour",
      avatarPickFailed: "Mise à jour de la photo impossible",
      avatarUnsupported: "Type d'image non supporté (PNG/JPEG/WEBP/GIF)",
      avatarTooLarge: "Image trop lourde (max 2MB)",
      moveTo: "Ajouter au Space",
      moveTitle: "DÉPLACER VERS",
    } as const;
  }, [language]);

  const [showAddToSpace, setShowAddToSpace] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setMessage] = useState("");
  const [, setFavoriteBusy] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const contactsIndex = useMemo(() => {
    const byEmail = new Map<string, Contact>();
    for (const c of contacts || []) {
      const e = String(c.email || "")
        .trim()
        .toLowerCase();
      if (!e) continue;
      byEmail.set(e, c);
    }
    return byEmail;
  }, [contacts]);

  const [brokenAvatarEmails, setBrokenAvatarEmails] = useState<
    Record<string, true>
  >({});
  const markAvatarBroken = (email: string) => {
    const key = (email || "").trim().toLowerCase();
    if (!key) return;
    setBrokenAvatarEmails((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: true };
    });
  };

  const [quickReplyBodyText, setQuickReplyBodyText] = useState("");
  const [quickReplyBodyHtml, setQuickReplyBodyHtml] = useState("");
  const [quickReplyBusy, setQuickReplyBusy] = useState(false);
  const [quickReplyFiles, setQuickReplyFiles] = useState<File[]>([]);
  const quickReplyFileRef = useRef<HTMLInputElement>(null);
  const [showQuickReplyFormatting, setShowQuickReplyFormatting] =
    useState(false);
  const [pendingMessages, setPendingMessages] = useState<Array<any>>([]);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const quickReplyRef = useRef<HTMLDivElement | null>(null);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);

  const extractEmail = (raw: string): string => {
    const m = (raw || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return (m?.[0] || "").trim().toLowerCase();
  };

  const getSenderParts = (rawFrom: string) => {
    const from = (rawFrom || "").trim();
    const email = extractEmail(from);
    const name = (() => {
      const lt = from.indexOf("<");
      if (lt > 0) return from.slice(0, lt).replace(/\"/g, "").trim();
      if (email) return from.replace(email, "").replace(/[<>]/g, "").trim();
      return from;
    })();
    return { name: name || email || "", email };
  };

  const cleanTextEmail = (text: string): string => {
    const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
    const out: string[] = [];
    const stopPatterns: RegExp[] = [
      /^On .+ wrote:$/i,
      /^Le .+ a écrit\s?:$/i,
      /^From:\s/i,
      /^De\s?:\s/i,
    ];
    const signaturePatterns: RegExp[] = [
      /^--\s*$/,
      /^Sent from my (iPhone|iPad)/i,
      /^Envoyé depuis mon (iPhone|iPad)/i,
    ];
    for (const line of lines) {
      const l = line.trimEnd();
      if (stopPatterns.some((re) => re.test(l.trim()))) break;
      if (signaturePatterns.some((re) => re.test(l.trim()))) break;
      if (/^>+\s?/.test(l.trim())) continue;
      out.push(l);
    }
    return out.join("\n").trim();
  };

  const cleanHtmlEmail = (html: string): string => {
    if (typeof window === "undefined") return html;
    try {
      const doc = new DOMParser().parseFromString(html || "", "text/html");
      const root = doc.body;
      const selectors = [
        "blockquote",
        ".gmail_quote",
        ".gmail_attr",
        ".gmail_signature",
        ".gmail_extra",
        ".yahoo_quoted",
        "#signature",
        ".signature",
        ".moz-cite-prefix",
      ];
      for (const sel of selectors) {
        root.querySelectorAll(sel).forEach((el) => el.remove());
      }
      const quoteHeaderRe = /(On .+ wrote:)|(Le .+ a écrit\s?:)/i;
      root.querySelectorAll("div, p, span").forEach((el) => {
        const t = (el.textContent || "").trim();
        if (quoteHeaderRe.test(t)) el.remove();
      });
      const hr = root.querySelector("hr");
      if (hr && hr.parentElement) {
        let n: ChildNode | null = hr;
        while (n) {
          const nextNode: ChildNode | null = n.nextSibling;
          n.parentNode?.removeChild(n);
          n = nextNode;
        }
      }
      return root.innerHTML;
    } catch {
      return html;
    }
  };

  const conversationMessages = useMemo(() => {
    const list = Array.isArray(thread) && thread.length ? [...thread] : [email];
    list.sort((a, b) => {
      const ta = Date.parse(a.dateIso || a.date || "") || 0;
      const tb = Date.parse(b.dateIso || b.date || "") || 0;
      return ta - tb;
    });
    return list;
  }, [email, thread]);

  const chatModeParam = (searchParams.get("chat") || "").trim();
  const manualChatEnabled =
    chatModeParam === "1" ||
    chatModeParam.toLowerCase() === "true" ||
    chatModeParam.toLowerCase() === "chat";
  const threadAutoChat =
    conversationMessages.length > 1 ||
    Boolean((email.inReplyTo || "").trim()) ||
    (Array.isArray(email.references) && email.references.length > 0);
  const chatEnabled = threadAutoChat || manualChatEnabled;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const mergedMessages = useMemo(() => {
    if (!pendingMessages.length) return conversationMessages;
    const realBodies = new Set(
      conversationMessages
        .map((m) => (m.bodyText || "").trim())
        .filter(Boolean),
    );
    const stillPending = pendingMessages.filter((m) => {
      const b = (m.bodyText || "").trim();
      if (!b) return false;
      return !realBodies.has(b);
    });
    const combined = [...conversationMessages, ...stillPending];
    combined.sort((a, b) => {
      const ta = Date.parse(a.dateIso || a.date || "") || 0;
      const tb = Date.parse(b.dateIso || b.date || "") || 0;
      return ta - tb;
    });
    return combined;
  }, [conversationMessages, pendingMessages]);

  useEffect(() => {
    if (!pendingMessages.length) return;
    const realBodies = new Set(
      conversationMessages
        .map((m) => (m.bodyText || "").trim())
        .filter(Boolean),
    );
    setPendingMessages((prev) =>
      prev.filter((m) => {
        const b = (m.bodyText || "").trim();
        if (!b) return false;
        return !realBodies.has(b);
      }),
    );
  }, [conversationMessages, pendingMessages.length]);

  useEffect(() => {
    if (!conversationMessages?.length) return;
    const id = window.requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [conversationMessages?.length]);

  const nav = useMemo(() => {
    const currentSpaceId = searchParams.get("space") || space.id || "principal";
    const rawBox = searchParams.get("box") || "inbox";
    const currentBox =
      rawBox === "inbox" ||
      rawBox === "drafts" ||
      rawBox === "spam" ||
      rawBox === "trash"
        ? rawBox
        : "inbox";
    const currentQuery = searchParams.get("q") || "";
    return { currentSpaceId, currentBox, currentQuery };
  }, [searchParams, space.id]);

  useEffect(() => {
    const loadSpaces = async () => {
      try {
        const res = await fetch("/api/spaces", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSpaces(data.spaces || []);
        }
      } catch (error) {
        console.error("Error fetching spaces:", error);
      }
    };
    loadSpaces();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchContacts = async () => {
      try {
        const res = await fetch("/api/contacts", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const data = (await res.json().catch(() => null)) as any;
        if (cancelled) return;
        if (res.ok && data?.ok && Array.isArray(data.contacts)) {
          setContacts(data.contacts);
        }
      } catch {
        /* ignore */
      }
    };
    void fetchContacts();
    const onContactsChanged = () => {
      void fetchContacts();
    };
    window.addEventListener("mailapp:contacts-changed", onContactsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("mailapp:contacts-changed", onContactsChanged);
    };
  }, []);

  const extractEmails = (raw: string) => {
    const text = raw || "";
    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    if (!matches) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of matches) {
      const v = m.trim().toLowerCase();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  };

  const normalizeReSubject = (subject: string) => {
    const s = (subject || "").trim();
    if (!s) return "";
    if (/^re\s*:/i.test(s)) return s;
    return `Re: ${s}`;
  };

  const stripSubjectPrefixes = (subject: string) => {
    let s = (subject || "").trim();
    if (!s) return "";
    while (true) {
      const next = s.replace(/^(\s*)(re|fwd|fw|tr)\s*:\s*/i, "");
      if (next === s) break;
      s = next.trim();
    }
    return s;
  };

  const displaySubject = useMemo(() => {
    const raw = email.subject || "";
    const stripped = stripSubjectPrefixes(raw);
    return stripped || raw || ui.noSubject;
  }, [email.subject, ui.noSubject]);

  const getConversationPartnerEmail = (): string => {
    const me = String(meEmail || "").toLowerCase();
    for (let i = mergedMessages.length - 1; i >= 0; i -= 1) {
      const m = mergedMessages[i];
      const sender = getSenderParts(m.from);
      const fromEmail = (m.senderEmail || sender.email || extractEmail(m.from))
        .trim()
        .toLowerCase();
      if (fromEmail && (!me || fromEmail !== me)) return fromEmail;
    }
    return (extractEmails(email.from)[0] || "").trim().toLowerCase();
  };

  const parseFrom = (from: string) => {
    const trimmed = (from || "").trim();
    const m = trimmed.match(/^(.*?)<\s*([^>]+)\s*>$/);
    if (m) {
      return {
        name: (m[1] || "").trim().replace(/^\"|\"$/g, ""),
        address: (m[2] || "").trim(),
      };
    }
    return {
      name: trimmed.includes("@") ? "" : trimmed,
      address: trimmed.includes("@") ? trimmed : "",
    };
  };

  const getInitials = (from: string) => {
    const { name, address } = parseFrom(from);
    const nameClean = (name || "").replace(/\s+/g, " ").trim();
    if (nameClean) {
      const words = nameClean
        .split(" ")
        .map((w) => w.trim())
        .filter(Boolean);
      const letters = words
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase();
      return (
        letters ||
        nameClean.replace(/[^a-zA-Z]/g, "").toUpperCase() ||
        "?"
      ).slice(0, 2);
    }
    const emailAddr = address || from;
    const local = ((emailAddr || "").split("@")[0] || "").trim();
    const fallback = local.replace(/[^a-zA-Z]/g, "").toUpperCase();
    return (fallback || "?").slice(0, 2);
  };

  const fromParsed = parseFrom(email.from);
  const fromLabel = fromParsed.name || fromParsed.address || email.from;

  const headerSenderEmail = extractEmails(email.from)[0] || "";
  const headerAvatarUrlRaw =
    headerSenderEmail && contactsIndex.get(headerSenderEmail)?.avatarUrl
      ? String(contactsIndex.get(headerSenderEmail)?.avatarUrl)
      : "";
  const headerAvatarUrl = headerAvatarUrlRaw.trim() || undefined;
  const headerCanShowAvatar =
    Boolean(headerSenderEmail) &&
    Boolean(headerAvatarUrl) &&
    !brokenAvatarEmails[headerSenderEmail];

  const bodyFontFamily =
    space?.mailFont === "mono"
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      : space?.mailFont === "system"
        ? 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"'
        : undefined;

  const formatBytes = (n: number | undefined) => {
    const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
    if (v <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let x = v;
    let idx = 0;
    while (x >= 1024 && idx < units.length - 1) {
      x /= 1024;
      idx += 1;
    }
    const digits = idx === 0 ? 0 : idx === 1 ? 0 : 1;
    return `${x.toFixed(digits)} ${units[idx]}`;
  };

  const setChatEnabledParam = (next: boolean) => {
    const sp = new URLSearchParams(searchParams);
    if (next) sp.set("chat", "1");
    else sp.delete("chat");
    router.replace(`/mail?${sp.toString()}`);
  };

  const handleSendQuickReply = async () => {
    if (!quickReplyBodyText.trim() && !quickReplyFiles.length) {
      alert(ui.emptyReply);
      return;
    }
    setQuickReplyBusy(true);
    try {
      const formData = new FormData();
      formData.append("to", getConversationPartnerEmail());
      formData.append("subject", normalizeReSubject(email.subject));
      formData.append("body", quickReplyBodyText);
      if (quickReplyBodyHtml.trim())
        formData.append("bodyHtml", quickReplyBodyHtml);
      if (email.messageId) formData.append("inReplyTo", email.messageId);
      if (Array.isArray(email.references)) {
        email.references.forEach((ref) => {
          if (ref) formData.append("references", ref);
        });
      }
      quickReplyFiles.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/mail/send", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as any;

      if (res.ok && data?.ok) {
        const now = new Date().toISOString();
        const newMsg = {
          id: `pending-${Date.now()}`,
          from: meEmail || "Me",
          senderEmail: meEmail,
          subject: normalizeReSubject(email.subject),
          date: now,
          dateIso: now,
          bodyHtml: quickReplyBodyHtml,
          bodyText: quickReplyBodyText,
          attachments: quickReplyFiles.map((f, i) => ({
            index: i,
            filename: f.name,
            size: f.size,
          })),
        };
        setPendingMessages((prev) => [...prev, newMsg]);
        setQuickReplyBodyHtml("");
        setQuickReplyBodyText("");
        setQuickReplyFiles([]);
        router.refresh();
      } else {
        alert(
          typeof data?.error === "string" ? data.error : ui.connectionError,
        );
      }
    } catch (e) {
      console.error(e);
      alert(ui.connectionError);
    } finally {
      setQuickReplyBusy(false);
    }
  };

  const handleReply = () => {
    setChatEnabledParam(true);
    setTimeout(() => {
      quickReplyRef.current?.focus();
    }, 100);
  };

  const handleReplyAll = () => {
    setChatEnabledParam(true);
    setTimeout(() => {
      quickReplyRef.current?.focus();
    }, 100);
  };

  const handleForward = () => {
    setChatEnabledParam(true);
    setTimeout(() => {
      const fwdPrefix = `\n\n--- Forwarded message ---\nFrom: ${email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n`;
      setQuickReplyBodyText(fwdPrefix + (email.bodyText || ""));
      quickReplyRef.current?.focus();
    }, 100);
  };

  const handleArchive = async () => {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/mail/archive", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emailId,
          spaceId: nav.currentSpaceId,
          box: nav.currentBox,
        }),
      });
      if (res.ok) {
        setMessage(ui.archived);
        const sp = new URLSearchParams();
        sp.set("space", nav.currentSpaceId);
        sp.set("box", nav.currentBox);
        if (nav.currentQuery) sp.set("q", nav.currentQuery);
        router.replace(`/mail?${sp.toString()}`);
        router.refresh();
      } else {
        setMessage(ui.archiveFailed);
      }
    } catch (e) {
      console.error(e);
      setMessage(ui.archiveFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (loading) return;
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/mail/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emailId,
          spaceId: nav.currentSpaceId,
          box: nav.currentBox,
        }),
      });
      if (res.ok) {
        setMessage(nav.currentBox === "trash" ? ui.deleted : ui.movedToTrash);
        const sp = new URLSearchParams();
        sp.set("space", nav.currentSpaceId);
        sp.set("box", nav.currentBox);
        if (nav.currentQuery) sp.set("q", nav.currentQuery);
        router.replace(`/mail?${sp.toString()}`);
        router.refresh();
      } else {
        setMessage(ui.deleteFailed);
      }
    } catch (e) {
      console.error(e);
      setMessage(ui.deleteFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSpam = async () => {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/mail/spam", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emailId,
          spaceId: nav.currentSpaceId,
          box: nav.currentBox,
        }),
      });
      if (res.ok) {
        setMessage("Mise en spam réussie");
        const sp = new URLSearchParams();
        sp.set("space", nav.currentSpaceId);
        sp.set("box", nav.currentBox);
        if (nav.currentQuery) sp.set("q", nav.currentQuery);
        router.replace(`/mail?${sp.toString()}`);
        router.refresh();
      } else {
        setMessage("Échec de la mise en spam");
      }
    } catch (e) {
      console.error(e);
      setMessage("Échec de la mise en spam");
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteSender = async () => {
    const senderEmail = extractEmails(email.from)[0];
    if (!senderEmail) return;
    setFavoriteBusy(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: senderEmail, favorite: true }),
      });
      if (res.ok) {
        alert(ui.favoriteAdded);
        window.dispatchEvent(new CustomEvent("mailapp:contacts-changed"));
      } else {
        alert(ui.favoriteAddFailed);
      }
    } catch (e) {
      console.error(e);
      alert(ui.favoriteAddFailed);
    } finally {
      setFavoriteBusy(false);
    }
  };

  const handleAddToSpace = async (targetSpaceId: string) => {
    try {
      const res = await fetch(`/api/spaces/${targetSpaceId}/add-email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, box: nav.currentBox }),
      });
      if (res.ok) {
        alert(ui.addedToSpace);
        setShowAddToSpace(false);
        router.refresh();
      } else {
        alert(ui.addToSpaceFailed);
      }
    } catch (e) {
      console.error(e);
      alert(ui.connectionError);
    }
  };

  const renderAttachments = (m: any) => {
    const msgAttachments = Array.isArray(m?.attachments)
      ? (m.attachments as any[])
      : [];
    if (!msgAttachments.length) return null;
    return (
      <div style={{ marginTop: 8 }}>
        {msgAttachments.map((a: any) => {
          const href = `/api/mail/attachment?id=${encodeURIComponent(String(m.id))}&index=${encodeURIComponent(String(a.index))}${m?.mailbox ? `&mailbox=${encodeURIComponent(String(m.mailbox))}` : ""}`;
          return (
            <a
              key={`${m.id}:${a.index}:${a.filename}`}
              href={href}
              className="email-detail-attachment-card"
              style={{ textDecoration: "none", display: "inline-flex" }}
            >
              <div className="email-detail-attachment-icon">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
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
                <span className="email-detail-attachment-name">
                  {a.filename || ui.attachmentFallbackName}
                </span>
                <div className="email-detail-attachment-meta">
                  <span>
                    {formatBytes(
                      typeof a.size === "number" ? a.size : undefined,
                    )}
                  </span>
                  <span className="email-detail-attachment-meta-separator" />
                  <span>{ui.download}</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className="email-detail" style={{ backgroundColor: "#fff" }}>
      <div className="email-detail-header">
        <div className="email-detail-sender-row">
          <div className="left">
            <div
              className="email-detail-sender-avatar"
              onClick={() => {
                const senderEmail = extractEmails(email.from)[0] || "";
                if (!senderEmail) return;
                avatarFileRef.current?.click();
              }}
              title={ui.avatarPick}
            >
              {headerCanShowAvatar ? (
                <img
                  src={headerAvatarUrl!}
                  alt=""
                  onError={() => markAvatarBroken(headerSenderEmail)}
                />
              ) : (
                <div className="email-detail-sender-avatar-placeholder">
                  {getInitials(email.from)}
                </div>
              )}
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (!f) return;
                }}
              />
            </div>
            <div className="email-detail-sender-info">
              <span className="email-detail-sender-name">{fromLabel}</span>
              <span className="email-detail-sender-email">
                {headerSenderEmail}
              </span>
            </div>
          </div>
          <div className="right">
            <div className="email-detail-header-date">{email.date}</div>
            <div className="email-detail-header-actions">
              <button className="email-detail-action-btn" onClick={handleReply}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 17 4 12 9 7"></polyline>
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                </svg>
                <span>{ui.reply}</span>
              </button>
              <button
                className="email-detail-action-btn"
                onClick={handleReplyAll}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="7 17 2 12 7 7"></polyline>
                  <polyline points="12 17 7 12 12 7"></polyline>
                  <path d="M22 18v-2a4 4 0 0 0-4-4H7"></path>
                </svg>
                <span>{ui.replyAll}</span>
              </button>
              <button
                className="email-detail-action-btn"
                onClick={handleForward}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 17 20 12 15 7"></polyline>
                  <path d="M4 18v-2a4 4 0 0 1 4-4h12"></path>
                </svg>
                <span>{ui.forward}</span>
              </button>
              <div style={{ position: "relative" }}>
                <button
                  className={`email-detail-action-btn icon-only ${showAddToSpace ? "active" : ""}`}
                  onClick={() => setShowAddToSpace(!showAddToSpace)}
                  title={ui.assign}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                {showAddToSpace && (
                  <div className="email-detail-more-menu">
                    <div className="menu-section-label">{ui.moveTo}</div>
                    {spaces.map((s) => (
                      <button
                        key={s.id}
                        className="menu-item"
                        onClick={() => handleAddToSpace(s.id)}
                      >
                        <SpaceIcon space={s} size={14} />
                        <span>{s.name}</span>
                      </button>
                    ))}
                    <div className="menu-divider" />
                    <button className="menu-item" onClick={handleArchive}>
                      <svg
                        width="16"
                        height="16"
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
                      <span>{ui.archive}</span>
                    </button>
                    <button className="menu-item" onClick={handleSpam}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                      <span>Mettre en spam</span>
                    </button>
                    <button
                      className="menu-item"
                      onClick={handleDelete}
                      style={{ color: "#ef4444" }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path
                          d="M17.5 3.33333H14.9166C14.7232 2.39284 14.2115 1.54779 13.4677 0.940598C12.7239 0.333408 11.7935 0.0012121 10.8333 0L9.16663 0C8.20645 0.0012121 7.27606 0.333408 6.53225 0.940598C5.78844 1.54779 5.27671 2.39284 5.08329 3.33333H2.49996C2.27895 3.33333 2.06698 3.42113 1.9107 3.57741C1.75442 3.73369 1.66663 3.94565 1.66663 4.16667C1.66663 4.38768 1.75442 4.59964 1.9107 4.75592C2.06698 4.9122 2.27895 5 2.49996 5H3.33329V15.8333C3.33462 16.938 3.77403 17.997 4.55514 18.7782C5.33626 19.5593 6.3953 19.9987 7.49996 20H12.5C13.6046 19.9987 14.6637 19.5593 15.4448 18.7782C16.2259 17.997 16.6653 16.938 16.6666 15.8333V5H17.5C17.721 5 17.9329 4.9122 18.0892 4.75592C18.2455 4.59964 18.3333 4.38768 18.3333 4.16667C18.3333 3.94565 18.2455 3.73369 18.0892 3.57741C17.9329 3.42113 17.721 3.33333 17.5 3.33333ZM9.16663 1.66667H10.8333C11.3502 1.6673 11.8542 1.82781 12.2763 2.1262C12.6984 2.42459 13.0178 2.84624 13.1908 3.33333H6.80913C6.98211 2.84624 7.30154 2.42459 7.72361 2.1262C8.14569 1.82781 8.64973 1.6673 9.16663 1.66667ZM15 15.8333C15 16.4964 14.7366 17.1323 14.2677 17.6011C13.7989 18.0699 13.163 18.3333 12.5 18.3333H7.49996C6.83692 18.3333 6.20103 18.0699 5.73219 17.6011C5.26335 17.1323 4.99996 16.4964 4.99996 15.8333V5H15V15.8333Z"
                          fill="#ef4444"
                        />
                      </svg>
                      <span>{ui.delete}</span>
                    </button>
                    <div className="menu-divider" />
                    <button
                      className="menu-item"
                      onClick={handleFavoriteSender}
                    >
                      <svg
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
                      </svg>
                      <span>{ui.favorite}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="email-detail-divider" />

      {/* Subject */}
      <div className="email-detail-subject">{displaySubject}</div>

      {/* Body */}
      <div
        className="email-detail-body"
        style={bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined}
      >
        {chatEnabled ? (
          <div className="email-detail-chat-container">
            {mergedMessages.map((m: any) => {
              const sender = getSenderParts(m.from);
              const fromEmail = (
                m.senderEmail ||
                sender.email ||
                extractEmail(m.from)
              ).trim();
              const cleanedHtml = m.bodyHtml
                ? isHydrated
                  ? cleanHtmlEmail(m.bodyHtml)
                  : m.bodyHtml
                : "";
              const cleanedText = m.bodyText ? cleanTextEmail(m.bodyText) : "";
              const displayName = sender.name || fromEmail || m.from || "";
              const initials = getInitials(m.from);
              const fromEmailKey = fromEmail.toLowerCase();
              const msgAvatarUrl =
                fromEmailKey && contactsIndex.get(fromEmailKey)?.avatarUrl
                  ? String(contactsIndex.get(fromEmailKey)?.avatarUrl)
                  : undefined;
              const msgCanShowAvatar =
                Boolean(fromEmailKey) &&
                Boolean(msgAvatarUrl) &&
                !brokenAvatarEmails[fromEmailKey];

              return (
                <div key={m.id} className="email-detail-chat-message">
                  <div className="email-detail-chat-avatar">
                    {msgCanShowAvatar ? (
                      <img
                        src={msgAvatarUrl!}
                        alt=""
                        onError={() => markAvatarBroken(fromEmailKey)}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="email-detail-chat-content">
                    <div className="email-detail-chat-meta">
                      <span className="sender-name">{displayName}</span>
                      <span className="timestamp">
                        <FormattedTime dateString={m.dateIso || m.date} />
                      </span>
                    </div>
                    <div className="email-detail-chat-body">
                      {cleanedHtml ? (
                        <div className="mail-html-wrap">
                          <div
                            className="mail-html"
                            dangerouslySetInnerHTML={{ __html: cleanedHtml }}
                          />
                        </div>
                      ) : cleanedText ? (
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {cleanedText}
                        </div>
                      ) : (
                        <div style={{ color: "#94a3b8", fontStyle: "italic" }}>
                          {ui.noContent}
                        </div>
                      )}

                      {m.attachments && m.attachments.length > 0 && (
                        <div className="email-detail-chat-attachments">
                          <div className="email-detail-attachments-title">
                            Attachments
                          </div>
                          {renderAttachments(m)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={threadEndRef} />
          </div>
        ) : (
          <div className="email-detail-body-content">
            {email.bodyHtml ? (
              <div className="mail-html-wrap">
                <div
                  className="mail-html"
                  dangerouslySetInnerHTML={{
                    __html: isHydrated
                      ? cleanHtmlEmail(email.bodyHtml)
                      : email.bodyHtml,
                  }}
                />
              </div>
            ) : email.bodyText ? (
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 15,
                  lineHeight: 1.5,
                }}
              >
                {cleanTextEmail(email.bodyText)}
              </div>
            ) : (
              <div style={{ color: "#94a3b8", fontStyle: "italic" }}>
                {ui.noContent}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attachments section (outside scrollable body for standard view) */}
      {!chatEnabled && email.attachments && email.attachments.length > 0 && (
        <div className="email-detail-attachments">
          <div className="email-detail-attachments-label">{ui.attachments}</div>
          <div>{renderAttachments(email)}</div>
        </div>
      )}

      {/* Quick reply for chat mode */}
      {chatEnabled && (
        <div className="email-detail-quick-reply-wrapper">
          <div className="email-detail-quick-reply-card">
            <div className="email-detail-quick-reply-body">
              <RichTextEditor
                ref={quickReplyRef}
                editorId="quick-reply"
                value={{ html: quickReplyBodyHtml, text: quickReplyBodyText }}
                onChange={(next) => {
                  setQuickReplyBodyHtml(next.html);
                  setQuickReplyBodyText(next.text);
                }}
                placeholder={ui.quickReplyPlaceholder}
                minHeightClassName="min-h-[100px]"
                disabled={quickReplyBusy}
                showToolbar={showQuickReplyFormatting}
              />
            </div>

            {quickReplyFiles.length > 0 && (
              <div
                className="email-detail-quick-reply-attachments"
                style={{
                  padding: "0 20px 12px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {quickReplyFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
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
                      <span
                        className="email-detail-attachment-name"
                        style={{
                          maxWidth: "120px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.name}
                      </span>
                      <div className="email-detail-attachment-meta">
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setQuickReplyFiles((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
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
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="email-detail-quick-reply-footer">
              <div className="email-detail-quick-reply-actions-left">
                <button
                  type="button"
                  className="quick-reply-action-btn delete"
                  title={ui.delete}
                  onClick={handleDelete}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M17.5 3.33333H14.9166C14.7232 2.39284 14.2115 1.54779 13.4677 0.940598C12.7239 0.333408 11.7935 0.0012121 10.8333 0L9.16663 0C8.20645 0.0012121 7.27606 0.333408 6.53225 0.940598C5.78844 1.54779 5.27671 2.39284 5.08329 3.33333H2.49996C2.27895 3.33333 2.06698 3.42113 1.9107 3.57741C1.75442 3.73369 1.66663 3.94565 1.66663 4.16667C1.66663 4.38768 1.75442 4.59964 1.9107 4.75592C2.06698 4.9122 2.27895 5 2.49996 5H3.33329V15.8333C3.33462 16.938 3.77403 17.997 4.55514 18.7782C5.33626 19.5593 6.3953 19.9987 7.49996 20H12.5C13.6046 19.9987 14.6637 19.5593 15.4448 18.7782C16.2259 17.997 16.6653 16.938 16.6666 15.8333V5H17.5C17.721 5 17.9329 4.9122 18.0892 4.75592C18.2455 4.59964 18.3333 4.38768 18.3333 4.16667C18.3333 3.94565 18.2455 3.73369 18.0892 3.57741C17.9329 3.42113 17.721 3.33333 17.5 3.33333ZM9.16663 1.66667H10.8333C11.3502 1.6673 11.8542 1.82781 12.2763 2.1262C12.6984 2.42459 13.0178 2.84624 13.1908 3.33333H6.80913C6.98211 2.84624 7.30154 2.42459 7.72361 2.1262C8.14569 1.82781 8.64973 1.6673 9.16663 1.66667ZM15 15.8333C15 16.4964 14.7366 17.1323 14.2677 17.6011C13.7989 18.0699 13.163 18.3333 12.5 18.3333H7.49996C6.83692 18.3333 6.20103 18.0699 5.73219 17.6011C5.26335 17.1323 4.99996 16.4964 4.99996 15.8333V5H15V15.8333Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
              <div className="email-detail-quick-reply-actions-right">
                <button
                  type="button"
                  className={`quick-reply-action-btn ${showQuickReplyFormatting ? "active" : ""}`}
                  onClick={() =>
                    setShowQuickReplyFormatting(!showQuickReplyFormatting)
                  }
                  title="Formatting"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
                  onClick={() => quickReplyFileRef.current?.click()}
                  className="quick-reply-action-btn"
                  title={ui.attachments}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M19.125 7.99983C18.9687 7.8436 18.7568 7.75584 18.5359 7.75584C18.3149 7.75584 18.103 7.8436 17.9467 7.99983L8.87002 17.1157C8.48311 17.5026 8.02378 17.8096 7.51824 18.019C7.0127 18.2285 6.47085 18.3363 5.92365 18.3363C4.81851 18.3364 3.75861 17.8975 2.9771 17.1161C2.1956 16.3347 1.75651 15.2748 1.75643 14.1697C1.75635 13.0646 2.19529 12.0047 2.97669 11.2232L11.7675 2.3965C12.2376 1.93391 12.8714 1.6758 13.5309 1.67841C14.1904 1.68102 14.8222 1.94412 15.2886 2.41042C15.755 2.87671 16.0183 3.50841 16.021 4.16792C16.0238 4.82743 15.7658 5.46131 15.3034 5.9315L6.51252 14.7582C6.35398 14.91 6.14291 14.9948 5.92335 14.9948C5.7038 14.9948 5.49273 14.91 5.33419 14.7582C5.17796 14.6019 5.0902 14.39 5.0902 14.169C5.0902 13.948 5.17796 13.7361 5.33419 13.5798L13.1609 5.71733C13.3127 5.56016 13.3966 5.34966 13.3947 5.13116C13.3928 4.91266 13.3052 4.70365 13.1507 4.54915C12.9962 4.39464 12.7872 4.307 12.5687 4.3051C12.3502 4.3032 12.1397 4.3872 11.9825 4.539L4.15585 12.4015C3.92366 12.6336 3.73947 12.9093 3.61381 13.2126C3.48815 13.5159 3.42347 13.8411 3.42347 14.1694C3.42347 14.4978 3.48815 14.8229 3.61381 15.1262C3.73947 15.4296 3.92366 15.7052 4.15585 15.9373C4.6322 16.3919 5.26534 16.6455 5.92377 16.6455C6.5822 16.6455 7.21534 16.3919 7.69169 15.9373L16.4817 7.10983C17.2467 6.32508 17.6717 5.27054 17.6647 4.17464C17.6577 3.07874 17.2192 2.02973 16.4442 1.25485C15.6692 0.479968 14.6201 0.0416165 13.5242 0.0347499C12.4283 0.0278832 11.3738 0.453055 10.5892 1.21816L1.79835 10.0448C0.704335 11.1388 0.0897217 12.6227 0.0897217 14.1698C0.0897217 15.717 0.704335 17.2008 1.79835 18.2948C2.89237 19.3888 4.37618 20.0035 5.92335 20.0035C7.47053 20.0035 8.95433 19.3888 10.0484 18.2948L19.125 9.1815C19.2029 9.10406 19.2647 9.01199 19.3068 8.9106C19.349 8.8092 19.3707 8.70047 19.3707 8.59066C19.3707 8.48085 19.349 8.37212 19.3068 8.27073C19.2647 8.16933 19.2029 8.07727 19.125 7.99983Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={quickReplyBusy}
                  className="quick-reply-send-btn"
                  onClick={handleSendQuickReply}
                >
                  <span>{quickReplyBusy ? ui.sending : ui.send}</span>
                  <svg
                    width="18"
                    height="18"
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
            </div>
          </div>
          <input
            ref={quickReplyFileRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              if (!list.length) return;
              setQuickReplyFiles((prev) => [...prev, ...list]);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
