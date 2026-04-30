import Link from "next/link";
import { getSession } from "@/lib/session";
import { getMessage } from "@/lib/gmail";
import { readSpaces } from "@/lib/persist";
import SpacesSidebar from "@/app/components/SpacesSidebar";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SpacePage({ params }: PageProps) {
  const { id: spaceId } = await params;
  const session = await getSession();

  const { spaces, spaceEmails } = await readSpaces(session);

  const space = spaces.find((s) => s.id === spaceId);
  if (!space) {
    return (
      <div className="flex h-screen">
        <SpacesSidebar initialSpaces={spaces || []} />
        <main className="flex-1 p-6">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-900">
            Space non trouvé.
          </div>
        </main>
      </div>
    );
  }

  const emailsByFolder = (spaceEmails as any)?.[spaceId] || {
    INBOX: [],
    SENT: [],
    DRAFTS: [],
    "[Gmail]/Spam": [],
    "[Gmail]/Trash": [],
  };

  // Get emails from INBOX folder for V1
  const emailIds = emailsByFolder.INBOX || [];

  // Fetch email details for each emailId
  const emailMetadata = await Promise.all(
    emailIds.slice(0, 20).map(async (emailId: string) => {
      try {
        const msg = await getMessage(emailId);
        return {
          id: emailId,
          subject: msg.subject,
          from: msg.from,
          date: msg.date,
          snippet: msg.snippet,
        };
      } catch {
        return {
          id: emailId,
          subject: "(Erreur de lecture)",
          from: "",
          date: "",
          snippet: "",
        };
      }
    }),
  );

  return (
    <div className="flex h-screen">
      <SpacesSidebar initialSpaces={spaces || []} />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{space.name}</h1>
            <p className="mt-2 text-slate-600">
              {emailIds.length} email{emailIds.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Emails List */}
          {emailIds.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
              <p>Aucun email dans ce Space.</p>
              <p className="mt-2 text-sm">
                Ouvre un email et ajoute-le à ce Space.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white">
              <ul className="divide-y">
                {emailMetadata.map((email) => (
                  <li key={email.id} className="p-4 hover:bg-slate-50">
                    <Link
                      href={`/mail?space=${encodeURIComponent(space.id)}&email=${encodeURIComponent(email.id)}`}
                      className="block"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {email.subject || "(sans sujet)"}
                          </div>
                          <div className="truncate text-xs text-slate-600">
                            {email.from}
                          </div>
                        </div>
                        <div className="whitespace-nowrap text-right text-xs text-slate-500">
                          {email.date}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 line-clamp-1">
                        {email.snippet}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
