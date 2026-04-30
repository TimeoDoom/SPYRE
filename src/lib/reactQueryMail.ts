import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

const PAGE_SIZE = 20;

async function fetchMails({ pageParam = undefined, queryKey }: any) {
  const box = (queryKey && queryKey[1] && queryKey[1].box) || "inbox";
  const url = new URL(`/api/mail/list`, location.origin);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("box", box);
  if (pageParam) url.searchParams.set("before", String(pageParam));

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch mails");
  return res.json(); // { items, nextCursor }
}

export function useMailsInfinite(box = "inbox") {
  return useInfiniteQuery(["mails", { box }], fetchMails, {
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
    cacheTime: 1000 * 60 * 60 * 24,
  });
}

export function useMail(id: string | undefined, mailbox = "INBOX") {
  return useQuery(
    ["mail", id, { mailbox }],
    async () => {
      if (!id) return null;
      const url = new URL(`/api/mail/get`, location.origin);
      url.searchParams.set("id", id);
      url.searchParams.set("mailbox", mailbox);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch mail");
      const data = await res.json();
      return data.message;
    },
    {
      enabled: Boolean(id),
      staleTime: 1000 * 60 * 60, // 1h for opened mail
    },
  );
}

export function useMarkAsRead() {
  const qc = useQueryClient();

  return useMutation(
    async ({ id, mailbox }: { id: string; mailbox?: string }) => {
      const res = await fetch(`/api/mail/mark-read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, mailbox }),
      });
      if (!res.ok) throw new Error("Mark read failed");
      return res.json();
    },
    {
      onMutate: async ({ id }) => {
        await qc.cancelQueries(["mails"]);
        const previous = qc.getQueryData(["mails"]);
        // optimistic update: set read=true in cached pages
        qc.setQueryData(["mails"], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages?.map((p: any) => ({
              ...p,
              items: p.items.map((m: any) =>
                m.id === id ? { ...m, read: true } : m,
              ),
            })),
          };
        });
        return { previous };
      },
      onError: (_err, _vars, context: any) => {
        if (context?.previous) qc.setQueryData(["mails"], context.previous);
      },
      onSettled: () => {
        qc.invalidateQueries(["mails"]);
      },
    },
  );
}
