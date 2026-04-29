import Link from "next/link";
import { getMessage } from "@/lib/gmail";
import { getSession } from "@/lib/session";
import { MessageContent } from "../_message-content";
import AddToSpaceButton from "@/app/components/AddToSpaceButton";
import { readSpaces } from "@/lib/persist";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MessagePage(props: PageProps) {
  const { id } = await props.params;
  const session = await getSession();
  const { spaces } = await readSpaces(session);

  try {
    const msg = await getMessage(id);

    const attachments = Array.isArray((msg as any).attachments)
      ? ((msg as any).attachments as any[])
      : [];

    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/mail" className="text-sm">
            ← Retour
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium"
          >
            Accueil
          </Link>
        </div>

        <div className="mt-4 rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-lg font-semibold">
                {msg.subject || "(sans sujet)"}
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">De</dt>
                  <dd className="break-words">{msg.from}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Date</dt>
                  <dd className="break-words">{msg.date}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">À</dt>
                  <dd className="break-words">{msg.to}</dd>
                </div>
              </dl>

              {attachments.length ? (
                <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm">
                  <div className="text-xs font-semibold text-slate-700">
                    Pièces jointes ({attachments.length})
                  </div>
                  <div className="mt-2 space-y-2">
                    {attachments.map((a: any) => (
                      <a
                        key={`${a.index}:${a.filename}`}
                        href={`/api/mail/attachment?id=${encodeURIComponent(id)}&index=${encodeURIComponent(String(a.index))}${(msg as any).mailbox ? `&mailbox=${encodeURIComponent((msg as any).mailbox)}` : ""}`}
                        className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs hover:bg-slate-100"
                        rel="noopener noreferrer"
                      >
                        <div className="truncate font-semibold text-slate-800">
                          {a.filename || "piece-jointe"}
                        </div>
                        <div className="truncate text-[11px] text-slate-600">
                          {typeof a.size === "number" ? `${a.size} B` : ""}
                          {a.contentType
                            ? typeof a.size === "number"
                              ? ` • ${a.contentType}`
                              : a.contentType
                            : ""}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex-shrink-0">
              <AddToSpaceButton emailId={id} spaces={spaces || []} />
            </div>
          </div>

          {msg.bodyHtml ? (
            <MessageContent bodyHtml={msg.bodyHtml} />
          ) : (
            <div className="mt-4 rounded-md bg-white p-4 text-sm leading-6 text-slate-700">
              Aucun contenu disponible.
            </div>
          )}
        </div>
      </main>
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Impossible de charger le message";

    return (
      <main className="mx-auto max-w-4xl p-6">
        <Link href="/mail" className="text-sm">
          ← Retour
        </Link>
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </div>
      </main>
    );
  }
}
