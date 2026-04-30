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
