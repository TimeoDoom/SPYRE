import "server-only";
import { getSession } from "@/lib/session";
import { readMailSettings } from "@/lib/persist";

export type MailEnv = {
  address: string;
  appPassword: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
};

export async function getMailEnv(): Promise<MailEnv> {
  const session = await getSession();
  const mail = await readMailSettings(session);

  if (mail?.address && mail.appPassword) {
    return {
      address: mail.address,
      appPassword: mail.appPassword,
      imap: {
        host: mail.imapHost ?? "imap.gmail.com",
        port: mail.imapPort ?? 993,
        secure: mail.imapSecure ?? true,
      },
      smtp: {
        host: mail.smtpHost ?? "smtp.gmail.com",
        port: mail.smtpPort ?? 465,
        secure: mail.smtpSecure ?? true,
      },
    };
  }

  throw new Error("Mail not configured");
}