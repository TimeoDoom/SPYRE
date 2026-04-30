"use client";
import { useEffect } from "react";

interface UseInitialPrefetchProps {
  emailIds: string[];
  mailbox?: string;
  batchSize?: number;
}

/**
 * Hook that prefetches emails aggressively for instant loading.
 * First batch loads immediately with high priority.
 */
export function useInitialPrefetch({
  emailIds,
  mailbox = "INBOX",
  batchSize = 5,
}: UseInitialPrefetchProps) {
  useEffect(() => {
    if (!emailIds.length) return;

    // Prefetch FIRST batch immediately with HIGH priority
    const firstBatch = emailIds.slice(0, batchSize);
    
    firstBatch.forEach((id, index) => {
      // Very aggressive staggering (30ms between requests)
      setTimeout(() => {
        const params = new URLSearchParams({ id, mailbox });
        fetch(`/api/mail/prefetch?${params}`, {
          method: "GET",
          priority: "high",
        }).catch(() => {
          // Silently fail - prefetch is optional
        });
      }, index * 30);
    });

    // Prefetch SECOND batch after a short delay
    const secondBatchTimer = setTimeout(() => {
      const secondBatch = emailIds.slice(batchSize, batchSize + 5);
      
      secondBatch.forEach((id, index) => {
        setTimeout(() => {
          const params = new URLSearchParams({ id, mailbox });
          fetch(`/api/mail/prefetch?${params}`, {
            method: "GET",
            priority: "low",
          }).catch(() => {});
        }, index * 100);
      });
    }, 500);

    // Prefetch REMAINING emails in background
    const remainingTimer = setTimeout(() => {
      const remaining = emailIds.slice(batchSize + 5);
      
      remaining.forEach((id, index) => {
        setTimeout(() => {
          const params = new URLSearchParams({ id, mailbox });
          fetch(`/api/mail/prefetch?${params}`, {
            method: "GET",
            priority: "low",
          }).catch(() => {});
        }, index * 300);
      });
    }, 2000);

    return () => {
      clearTimeout(secondBatchTimer);
      clearTimeout(remainingTimer);
    };
  }, [emailIds, mailbox, batchSize]);
}