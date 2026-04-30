// Client-side prefetch helper with module-level dedupe and simple concurrency
const PREFETCHED = new Set<string>();
const QUEUE: Array<() => Promise<void>> = [];
let active = 0;
const MAX_CONCURRENT = 2;

function runQueue() {
  while (QUEUE.length > 0 && active < MAX_CONCURRENT) {
    const job = QUEUE.shift();
    if (!job) break;
    active++;
    job()
      .catch(() => {})
      .finally(() => {
        active--;
        // schedule next cycle
        setTimeout(runQueue, 0);
      });
  }
}

export function schedulePrefetch(id: string, mailbox = "INBOX") {
  if (!id) return;
  const key = `${mailbox}:${id}`;
  if (PREFETCHED.has(key)) return;
  PREFETCHED.add(key);

  const task = async () => {
    try {
      const url = `/api/mail/prefetch?id=${encodeURIComponent(id)}&mailbox=${encodeURIComponent(mailbox)}`;
      await fetch(url, {
        method: "GET",
        credentials: "include",
      });
    } catch (_e) {
      // ignore failures - prefetch is best-effort
    }
  };

  // Defer scheduling to idle to avoid contention with user interactions
  const schedule = () => {
    QUEUE.push(task);
    runQueue();
  };

  if (typeof (window as any).requestIdleCallback === "function") {
    try {
      (window as any).requestIdleCallback(schedule, { timeout: 2000 });
    } catch (_) {
      setTimeout(schedule, 300);
    }
  } else {
    setTimeout(schedule, 300);
  }
}

export function clearPrefetchState() {
  PREFETCHED.clear();
  QUEUE.length = 0;
}

export default { schedulePrefetch, clearPrefetchState };
