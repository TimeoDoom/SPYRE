"use client";

import { useEffect, useRef } from "react";

interface PrefetchEmailProps {
  emailId: string;
  mailbox?: string;
  children: React.ReactNode;
  onMouseEnter?: () => void;
}

/**
 * Wrapper component that prefetches an email when user hovers over it.
 * This populates the server cache before actual navigation happens.
 * Makes the email detail view load nearly instantly.
 */
export function PrefetchEmail({
  emailId,
  mailbox = "INBOX",
  children,
  onMouseEnter,
}: PrefetchEmailProps) {
  const prefetchedRef = useRef(false);

  const doPrefetch = () => {
    if (prefetchedRef.current) return; // Only prefetch once per instance
    prefetchedRef.current = true;

    // Fire and forget - we don't care about the response
    const params = new URLSearchParams({
      id: emailId,
      mailbox,
    });

    fetch(`/api/mail/prefetch?${params}`, {
      method: "GET",
      priority: "low", // Don't interfere with user navigation
    }).catch(() => {
      // Silently fail - prefetch is an optimization, not critical
    });
  };

  return (
    <div
      onMouseEnter={() => {
        doPrefetch();
        onMouseEnter?.();
      }}
      // Also prefetch on focus for keyboard users
      onFocus={(e) => {
        if (e.currentTarget === e.target) {
          doPrefetch();
        }
      }}
    >
      {children}
    </div>
  );
}
