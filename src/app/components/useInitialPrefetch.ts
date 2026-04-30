"use client";

import { useEffect } from "react";

interface UseInitialPrefetchProps {
  emailIds: string[];
  mailbox?: string;
  batchSize?: number;
}

/**
 * Hook that prefetches the first N emails on mount.
 * Spreads requests to avoid overwhelming the server.
 */
export function useInitialPrefetch({
  emailIds,
  mailbox = "INBOX",
  batchSize = 3,
}: UseInitialPrefetchProps) {
  useEffect(() => {
    if (!emailIds.length) return;

    // Prefetch first batch immediately
    const idsToFetch = emailIds.slice(0, batchSize);

    idsToFetch.forEach((id, index) => {
      // Stagger requests by 100ms to avoid thundering herd
      setTimeout(() => {
        const params = new URLSearchParams({ id, mailbox });
        fetch(`/api/mail/prefetch?${params}`, {
          method: "GET",
          priority: "low",
        }).catch(() => {
          // Silently fail
        });
      }, index * 100);
    });

    // Prefetch next batch after 2 seconds (when user likely settled)
    const secondBatchDelay = setTimeout(() => {
      const secondBatch = emailIds.slice(
        batchSize,
        Math.min(batchSize + 3, emailIds.length),
      );

      secondBatch.forEach((id, index) => {
        setTimeout(() => {
          const params = new URLSearchParams({ id, mailbox });
          fetch(`/api/mail/prefetch?${params}`, {
            method: "GET",
            priority: "low",
          }).catch(() => {
            // Silently fail
          });
        }, index * 100);
      });
    }, 2000);

    return () => clearTimeout(secondBatchDelay);
  }, [emailIds, mailbox, batchSize]);
}
