"use client";

import { useEffect, useMemo, useState } from "react";
import type { Space } from "@/lib/session";
import EmailDetail from "./EmailDetail";

type EmailMessage = {
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
  snippet?: string;
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
  seen?: boolean;
};

type Props = {
  emailId?: string | null;
  mailboxName: string;
  language: "fr" | "en";
  space: Space;
  meEmail?: string;
};

export default function MailReaderPane({
  emailId,
  mailboxName,
  language,
  space,
  meEmail,
}: Props) {
  const [message, setMessage] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const normalizedMailbox = useMemo(
    () => mailboxName || "INBOX",
    [mailboxName],
  );

  useEffect(() => {
    const id = (emailId || "").trim();
    if (!id) {
      setMessage(null);
      setErrorMsg("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg("");

    fetch(
      `/api/emails/${encodeURIComponent(id)}?folder=${encodeURIComponent(normalizedMailbox)}`,
      {
        credentials: "include",
        signal: controller.signal,
      },
    )
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load email");
        }
        return res.json();
      })
      .then((data) => {
        setMessage(data.message || null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setMessage(null);
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to load email",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [emailId, normalizedMailbox]);

  if (loading) {
    return (
      <div className="email-detail">
        <div className="flex h-full items-center justify-center p-6 text-slate-500 dark:text-slate-400">
          <div className="text-sm">Chargement du message…</div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="email-detail">
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md rounded-[20px] border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/40">
            <div className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
              {language === "en"
                ? "Email loading error"
                : "Erreur de chargement"}
            </div>
            <div className="text-sm text-red-800 dark:text-red-200">
              {errorMsg}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="email-detail">
        <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
          <div className="text-center">
            <div className="text-lg">
              {language === "en" ? "Select an email" : "Sélectionne un email"}
            </div>
            <div className="mt-1 text-sm">
              {language === "en"
                ? "The message will appear here"
                : "Le message s'affichera ici"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmailDetail
      email={message as any}
      emailId={message.id}
      space={space}
      thread={undefined}
      meEmail={meEmail}
    />
  );
}
