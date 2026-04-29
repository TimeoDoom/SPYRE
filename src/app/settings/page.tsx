import Link from "next/link";
import { getSession } from "@/lib/session";
import TestMailConnection from "@/app/components/TestMailConnection";
import { normalizeAppLanguage, t } from "@/lib/i18n";
import { readMailSettings, readUiSettings } from "@/lib/persist";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const saved = sp.saved === "1";
  const error = typeof sp.error === "string" ? sp.error : "";

  const session = await getSession();
  const ui = await readUiSettings(session);
  const language = normalizeAppLanguage(ui.language);

  const mail = await readMailSettings(session);
  const existingAddress = mail?.address ?? "";
  const hasPassword = Boolean(mail?.appPassword);

  const imapHost = mail?.imapHost ?? "imap.gmail.com";
  const imapPort = String(mail?.imapPort ?? 993);
  const imapSecure = mail?.imapSecure ?? true;

  const smtpHost = mail?.smtpHost ?? "smtp.gmail.com";
  const smtpPort = String(mail?.smtpPort ?? 465);
  const smtpSecure = mail?.smtpSecure ?? true;

  return (
    <main className="mx-auto max-w-3xl p-6 text-slate-900 dark:text-slate-50">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t(language, "settings.title")}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/mail"
            className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-800"
          >
            {t(language, "nav.inbox")}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-800"
          >
            {t(language, "nav.home")}
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
        {t(language, "settings.desc")}
      </p>
      {saved ? (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {t(language, "settings.saved")}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      <form
        action="/api/ui/language"
        method="post"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">
              {t(language, "settings.language")}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {t(language, "settings.languageHint")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              name="language"
              value="fr"
              className={
                "rounded-md border px-3 py-2 text-sm font-semibold " +
                (language === "fr"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50")
              }
              aria-pressed={language === "fr"}
            >
              Français
            </button>
            <button
              type="submit"
              name="language"
              value="en"
              className={
                "rounded-md border px-3 py-2 text-sm font-semibold " +
                (language === "en"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50")
              }
              aria-pressed={language === "en"}
            >
              English
            </button>
          </div>
        </div>
      </form>

      <form
        action="/api/settings/save"
        method="post"
        className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="block">
          <div className="text-sm font-medium">
            {t(language, "settings.gmailAddress")}
          </div>
          <input
            name="address"
            type="email"
            required
            defaultValue={existingAddress}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="tonadresse@gmail.com"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">
            {t(language, "settings.appPassword")}
          </div>
          <input
            name="appPassword"
            type="password"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder={
              hasPassword ? "•••••••• (déjà enregistré)" : "xxxx xxxx xxxx xxxx"
            }
            autoComplete="current-password"
          />
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {t(language, "settings.keepExisting")}
          </div>
        </label>

        <details className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-medium">
            {t(language, "settings.optionalAdvanced")}
          </summary>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="text-sm font-medium">IMAP host</div>
              <input
                name="imapHost"
                type="text"
                defaultValue={imapHost}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium">IMAP port</div>
              <input
                name="imapPort"
                type="number"
                inputMode="numeric"
                defaultValue={imapPort}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                name="imapSecure"
                type="checkbox"
                defaultChecked={imapSecure}
              />
              IMAP secure (TLS)
            </label>

            <div />

            <label className="block">
              <div className="text-sm font-medium">SMTP host</div>
              <input
                name="smtpHost"
                type="text"
                defaultValue={smtpHost}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium">SMTP port</div>
              <input
                name="smtpPort"
                type="number"
                inputMode="numeric"
                defaultValue={smtpPort}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                name="smtpSecure"
                type="checkbox"
                defaultChecked={smtpSecure}
              />
              SMTP secure (TLS)
            </label>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {t(language, "settings.save")}
          </button>

          <button
            type="submit"
            formAction="/api/settings/clear"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium"
          >
            {t(language, "settings.clear")}
          </button>
        </div>
      </form>
      <p className="mt-4 text-xs text-slate-600">
        Si tu utilises un mot de passe d’application, active d’abord IMAP dans
        Gmail et la 2FA sur ton compte.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold mb-3">
          {t(language, "settings.diagnose")}
        </h2>
        <p className="text-sm text-slate-600 mb-4 dark:text-slate-300">
          {t(language, "settings.diagnoseDesc")}
        </p>
        <TestMailConnection />
      </div>
    </main>
  );
}
