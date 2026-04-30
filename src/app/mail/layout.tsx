import MailColumns from "@/app/mail/_columns";
import { getMailboxes, listMailboxThreads } from "@/lib/gmail";
import { getSession, ensureDefaultSpace } from "@/lib/session";
import type { ReactNode } from "react";
import { getSession, ensureDefaultSpace } from "@/lib/session";

export default async function MailLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  ensureDefaultSpace(session);

  return <>{children}</>;
}
    </div>
  );
}
