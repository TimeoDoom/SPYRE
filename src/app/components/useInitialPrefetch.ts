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

    const firstBatch = emailIds.slice(0, 2);

    firstBatch.forEach((id, index) => {
      const timer = setTimeout(() => {
        // Use shared schedulePrefetch helper to dedupe and defer work
        import("@/lib/prefetchClient").then(({ schedulePrefetch }) => {
          schedulePrefetch(id, mailbox);
        });
      }, index * 500);

      return () => clearTimeout(timer);
    });
  }, [emailIds, mailbox, batchSize]);
}
