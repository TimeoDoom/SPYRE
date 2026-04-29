import { getSession, ensureDefaultSpace } from "@/lib/session";

export default async function MailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Ensure default "Principal" space exists
  ensureDefaultSpace(session);

  return <>{children}</>;
}
