import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSession } from "@/lib/session";
import { normalizeAppLanguage } from "@/lib/i18n";
import { LanguageProvider } from "@/app/components/LanguageProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MailApp",
  description: "Client Gmail simple (lecture + envoi)",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const theme = session.ui?.theme === "dark" ? "dark" : "light";
  const language = normalizeAppLanguage(session.ui?.language);
  const texture = session.ui?.texture ?? "glass";
  const background = session.ui?.background;

  const customBgStyle: React.CSSProperties | undefined = (() => {
    if (!background) return undefined;
    if (background.kind === "solid") {
      return { backgroundColor: background.color };
    }
    const angle = Number.isFinite(background.angle) ? background.angle : 135;
    return {
      backgroundImage: `linear-gradient(${angle}deg, ${background.from}, ${background.to})`,
    };
  })();

  // Determine the background style
  const bgStyle: React.CSSProperties = customBgStyle || {
    background:
      texture === "none"
        ? "#F9F9F9"
        : "linear-gradient(135deg, #F9F9F9 0%, #F9F9F9 50%, #f1f5f9 100%)",
  };

  return (
    <html lang={language} className={theme === "dark" ? "dark" : undefined}>
      <body
        className={`${inter.className} min-h-screen text-slate-900 dark:text-slate-50`}
        style={bgStyle}
      >
        {texture === "grain" ? (
          <div
            aria-hidden="true"
            className="app-grain fixed inset-0 z-[-10] opacity-[0.22] dark:opacity-[0.14]"
          />
        ) : null}

        <LanguageProvider language={language}>
          <div className="relative">{children}</div>
        </LanguageProvider>
      </body>
    </html>
  );
}
