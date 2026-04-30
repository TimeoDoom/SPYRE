"use client";

import { Suspense } from "react";
import EmailListSidebar from "./EmailListSidebar";
import { MailListLoader } from "./MailListLoader";
import { useInitialPrefetch } from "./useInitialPrefetch";
import type { CSSProperties } from "react";
import type { Space } from "@/lib/session";

interface EmailListWithPrefetchProps {
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
  mailbox?: string;
  spaces?: Space[];
  spaceName?: string;
  accentColor?: string;
  columnBgStyle?: CSSProperties;
  textColor?: string;
  buttonBgColor?: string;
  mailFontSize?: number;
  selectedEmailId?: string;
  onSelectEmail?: (emailId: string) => void;
}

/**
 * Wrapper that adds prefetching and loading state to EmailListSidebar.
 * Prefetches first 6 emails automatically on mount.
 */
export function EmailListWithPrefetch({
  emails,
  mailbox = "INBOX",
  ...props
}: EmailListWithPrefetchProps) {
  const emailIds = emails.map((e) => e.id);

  // Prefetch first 6 emails on mount (3 immediately, 3 after 2s)
  useInitialPrefetch({
    emailIds,
    mailbox,
    batchSize: 3,
  });

  return (
    <Suspense fallback={<MailListLoader />}>
      <EmailListSidebar emails={emails} mailbox={mailbox} {...props} />
    </Suspense>
  );
}
