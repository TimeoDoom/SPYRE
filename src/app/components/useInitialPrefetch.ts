"use client";
import { useEffect } from "react";

interface UseInitialPrefetchProps {
  emailIds: string[];
  mailbox?: string;
  batchSize?: number;
}

/**
 * Hook that prefetches emails conservatively to avoid IMAP socket timeouts.
 * Only prefetch top 2 items on mount, with conservative delays.
 */
export function useInitialPrefetch({
  emailIds,
  mailbox = "INBOX",
  batchSize = 5,
}: UseInitialPrefetchProps) {
  useEffect(() => {
    if (!emailIds.length) return;

    // Prefetch only the FIRST 2 emails with long spacing to avoid connection pool exhaustion
    const firstBatch = emailIds.slice(0, 2);
    
    firstBatch.forEach((id, index) => {
      // Very conservative staggering (500ms between requests)
      const timer = setTimeout(() => {
        const params = new URLSearchParams({ id, mailbox });
        fetch(`/api/mail/prefetch?${params}`, {
          method: "GET",
          priority: "low",
          signal: AbortSignal.timeout(10000), // 10 second timeout per request
        }).catch(() => {
          // Silently fail - prefetch is optional
        });
      }, index * 500);

      return () => clearTimeout(timer);
    });

    // Don't prefetch remaining emails on mount to avoid connection pool issues
    // They will be prefetched on-demand via hover/focus instead
  }, [emailIds, mailbox, batchSize]);
}