import Link from "next/link";
import { getSession } from "@/lib/session";
import { normalizeAppLanguage, t } from "@/lib/i18n";

export default async function HomePage() {
  const session = await getSession();
  const configuredEmail = session.mail?.address ?? "";
  const language = normalizeAppLanguage(session.ui?.language);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">MailApp</h1>
      <p className="mt-2 text-slate-700">{t(language, "home.desc")}</p>

      <div className="mt-6 rounded-lg border bg-white p-4">
        {configuredEmail ? (
          <div className="text-sm text-slate-700">
            {t(language, "home.configured")}{" "}
            <span className="font-medium">{configuredEmail}</span>
          </div>
        ) : (
          <div className="text-sm text-slate-700">
            {t(language, "home.notConfiguredPrefix")}{" "}
            <Link href="/settings" className="underline">
              {t(language, "nav.settings")}
            </Link>
            {t(language, "home.notConfiguredSuffix")}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/mail"
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {t(language, "home.openInbox")}
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium"
          >
            {t(language, "nav.settings")}
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Cette app n&apos;utilise pas OAuth Google. Gmail nécessite un mot de
        passe d&apos;application (2FA) pour IMAP/SMTP.
      </p>
    </main>
  );
}
