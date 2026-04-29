import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";

export type MailSettings = {
  address: string;
  appPassword: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
};

export type UiBackground =
  | {
      kind: "solid";
      color: string; // hex
    }
  | {
      kind: "gradient";
      from: string; // hex
      to: string; // hex
      angle?: number; // degrees
    };

export type Space = {
  id: string;
  name: string;
  color?: string; // Accent color (hex)
  icon?: string; // Emoji icon
  bgColor?: string; // Background tint (hex)
  columnBgColor?: string; // Mail columns background (hex)
  columnBackground?: UiBackground; // Mail columns background (solid/gradient)
  textColor?: string; // Text color (hex)
  buttonBgColor?: string; // Primary button background (hex)
  mailFont?: "inter" | "system" | "mono";
  mailFontSize?: number; // px
  railGradientFrom?: string; // Space button gradient start (hex)
  railGradientTo?: string; // Space button gradient end (hex)
  appBackground?: UiBackground; // Background behind the mail columns for this space
  createdAt: Date;
};

export type Contact = {
  email: string;
  favorite?: boolean;
  avatarUrl?: string;
  createdAt: number; // unix ms
};

export type SessionData = {
  // Stable identifier used to persist user data in PostgreSQL (Neon)
  dbUserId?: string;
  mail?: MailSettings;
  ui?: {
    theme?: "light" | "dark";
    texture?: "none" | "glass" | "grain" | "gradient";
    background?: UiBackground;
    language?: "fr" | "en";
  };
  spaces?: Space[];
  contacts?: Contact[];
  // New structure: spaceId -> dossier -> [emailIds]
  // Ex: { "space-aaa": { "INBOX": [uid1, uid2], "SENT": [uid3] }, ... }
  spaceEmails?: Record<string, Record<string, string[]>>;
};

const COOKIE_NAME = "mailapp_session";

function getSessionPassword() {
  // Recommended: set SESSION_PASSWORD (min 32 chars) in production.
  // For local dev, we fall back to a per-process random secret to avoid crashing.
  const fromEnv = process.env.SESSION_PASSWORD;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  const g = globalThis as unknown as { __mailappSessionPassword?: string };
  if (!g.__mailappSessionPassword) {
    g.__mailappSessionPassword = crypto.randomBytes(32).toString("base64url");
  }
  return g.__mailappSessionPassword;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const password = getSessionPassword();

  return getIronSession<SessionData>(await cookies(), {
    cookieName: COOKIE_NAME,
    password,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}

export function ensureDefaultSpace(session: IronSession<SessionData>): void {
  // Ensure "Principal" space exists (global inbox) - WITHOUT saving
  // NOTE: We must ensure it exists even when other spaces exist,
  // otherwise /mail?space=principal would redirect-loop.
  const principalSpace: Space = {
    id: "principal",
    name: "Principal",
    icon: "📥",
    color: "#3B82F6",
    bgColor: "#F0F4FF",
    columnBgColor: undefined,
    columnBackground: undefined,
    textColor: "#1E293B",
    buttonBgColor: undefined,
    createdAt: new Date(),
  };

  if (!session.spaces) session.spaces = [];

  const hasPrincipal = session.spaces.some((s) => s.id === "principal");
  if (!hasPrincipal) {
    session.spaces.unshift(principalSpace);
  }

  if (!session.spaceEmails) session.spaceEmails = {};
  if (!session.spaceEmails.principal) {
    session.spaceEmails.principal = {
      INBOX: [],
      SENT: [],
      DRAFTS: [],
      "[Gmail]/Spam": [],
      "[Gmail]/Trash": [],
    };
  } else {
    // Ensure required folders exist
    session.spaceEmails.principal.INBOX ??= [];
    session.spaceEmails.principal.SENT ??= [];
    session.spaceEmails.principal.DRAFTS ??= [];
    session.spaceEmails.principal["[Gmail]/Spam"] ??= [];
    session.spaceEmails.principal["[Gmail]/Trash"] ??= [];
  }
}
