import "server-only";

import crypto from "node:crypto";
import type { IronSession } from "iron-session";
import type {
  SessionData,
  Space,
  UiBackground,
  MailSettings,
  Contact,
} from "./session";
import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./encryption";

export function isPersistenceEnabled() {
  return prisma != null;
}

export async function ensureDbUserId(
  session: IronSession<SessionData>,
  options?: {
    /**
     * When true, persists dbUserId to the session cookie via session.save().
     * Must only be used in Route Handlers / Server Actions.
     */
    allowCookieWrite?: boolean;
  },
): Promise<string | null> {
  if (!prisma) return null;

  if (session.dbUserId) return session.dbUserId;

  if (!options?.allowCookieWrite) {
    // In Server Components, Next.js forbids mutating cookies.
    // We therefore do not create/persist an id during render.
    return null;
  }

  session.dbUserId = crypto.randomUUID();
  await session.save();
  return session.dbUserId;
}

export async function ensureDbUser(
  session: IronSession<SessionData>,
  options?: {
    allowCookieWrite?: boolean;
  },
): Promise<string | null> {
  if (!prisma) return null;

  const id = await ensureDbUserId(session, options);
  if (!id) return null;

  await prisma.user.upsert({
    where: { id },
    create: { id },
    update: {},
  });

  // One-time migration from cookie-session into DB if DB fields are empty.
  await migrateSessionToDb(session, id);

  return id;
}

function normalizeSpace(
  space: any,
): Omit<Space, "createdAt"> & { createdAt: Date } {
  return {
    id: String(space.id),
    name: String(space.name ?? "").trim() || "Untitled",
    color: typeof space.color === "string" ? space.color : undefined,
    icon: typeof space.icon === "string" ? space.icon : undefined,
    bgColor: typeof space.bgColor === "string" ? space.bgColor : undefined,
    columnBgColor:
      typeof space.columnBgColor === "string" ? space.columnBgColor : undefined,
    textColor:
      typeof space.textColor === "string" ? space.textColor : undefined,
    mailFont:
      space.mailFont === "inter" ||
      space.mailFont === "system" ||
      space.mailFont === "mono"
        ? space.mailFont
        : undefined,
    railGradientFrom:
      typeof space.railGradientFrom === "string"
        ? space.railGradientFrom
        : undefined,
    railGradientTo:
      typeof space.railGradientTo === "string"
        ? space.railGradientTo
        : undefined,
    appBackground: (space.appBackground ?? undefined) as
      | UiBackground
      | undefined,
    createdAt:
      space.createdAt instanceof Date
        ? space.createdAt
        : new Date(space.createdAt ?? Date.now()),
  };
}

export async function migrateSessionToDb(
  session: IronSession<SessionData>,
  userId: string,
): Promise<void> {
  if (!prisma) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const updates: any = {};

  // Mail settings
  if (!user.mailAddress && session.mail?.address) {
    updates.mailAddress = session.mail.address;
  }
  if (!user.mailAppPasswordEnc && session.mail?.appPassword) {
    updates.mailAppPasswordEnc = encryptSecret(session.mail.appPassword);
  }
  if (user.imapHost == null && session.mail?.imapHost != null)
    updates.imapHost = session.mail.imapHost;
  if (user.imapPort == null && session.mail?.imapPort != null)
    updates.imapPort = session.mail.imapPort;
  if (user.imapSecure == null && session.mail?.imapSecure != null)
    updates.imapSecure = session.mail.imapSecure;
  if (user.smtpHost == null && session.mail?.smtpHost != null)
    updates.smtpHost = session.mail.smtpHost;
  if (user.smtpPort == null && session.mail?.smtpPort != null)
    updates.smtpPort = session.mail.smtpPort;
  if (user.smtpSecure == null && session.mail?.smtpSecure != null)
    updates.smtpSecure = session.mail.smtpSecure;

  // UI settings
  if (user.uiTheme == null && session.ui?.theme)
    updates.uiTheme = session.ui.theme;
  if (user.uiTexture == null && session.ui?.texture)
    updates.uiTexture = session.ui.texture;
  if (user.uiLanguage == null && session.ui?.language)
    updates.uiLanguage = session.ui.language;
  if (user.uiBackground == null && session.ui?.background)
    updates.uiBackground = session.ui.background as any;

  // spaceEmails
  if (user.spaceEmails == null && session.spaceEmails) {
    updates.spaceEmails = session.spaceEmails as any;
  }

  if (Object.keys(updates).length) {
    await prisma.user.update({ where: { id: userId }, data: updates });
  }

  // Spaces
  const existingSpaces = await prisma.space.findMany({
    where: { userId },
    select: { id: true },
  });
  const existingSpaceIds = new Set(
    existingSpaces.map((s: { id: string }) => s.id),
  );

  const sessionSpaces = Array.isArray(session.spaces) ? session.spaces : [];
  const toCreate = sessionSpaces
    .filter(
      (s) =>
        s &&
        typeof (s as any).id === "string" &&
        !existingSpaceIds.has((s as any).id),
    )
    .map((s) => normalizeSpace(s));

  if (toCreate.length) {
    // SQLite Prisma Client doesn't support createMany({ skipDuplicates }).
    // We dedupe by id and fall back to upsert in case of races.
    const client = prisma;
    const uniqueById = new Map<string, (typeof toCreate)[number]>();
    for (const space of toCreate) uniqueById.set(space.id, space);
    const unique = [...uniqueById.values()];

    const data = unique.map((s) => ({
      id: s.id,
      userId,
      name: s.name,
      color: s.color,
      icon: s.icon,
      bgColor: s.bgColor,
      columnBgColor: s.columnBgColor,
      textColor: s.textColor,
      mailFont: s.mailFont,
      railGradientFrom: s.railGradientFrom,
      railGradientTo: s.railGradientTo,
      appBackground: s.appBackground as any,
      createdAt: s.createdAt,
    }));

    try {
      await client.space.createMany({ data });
    } catch {
      await client.$transaction(
        data.map((s) =>
          client.space.upsert({
            where: { id: s.id },
            create: s,
            update: {},
          }),
        ),
      );
    }
  }

  // Contacts
  const sessionContacts = Array.isArray(session.contacts)
    ? session.contacts
    : [];
  if (sessionContacts.length) {
    for (const c of sessionContacts) {
      if (!c?.email) continue;
      const email = String(c.email).trim().toLowerCase();
      if (!email) continue;
      await prisma.contact.upsert({
        where: { userId_email: { userId, email } },
        create: {
          userId,
          email,
          favorite: Boolean((c as any).favorite),
          avatarUrl:
            typeof (c as any).avatarUrl === "string"
              ? String((c as any).avatarUrl).trim() || null
              : null,
          createdAt: new Date((c as any).createdAt ?? Date.now()),
        },
        update: {
          favorite: Boolean((c as any).favorite),
          avatarUrl:
            typeof (c as any).avatarUrl === "string"
              ? String((c as any).avatarUrl).trim() || null
              : undefined,
        },
      });
    }
  }
}

export async function readMailSettings(
  session: IronSession<SessionData>,
): Promise<MailSettings | null> {
  const userId = await ensureDbUser(session);
  if (!prisma || !userId) return session.mail ?? null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mailAddress || !user.mailAppPasswordEnc)
    return session.mail ?? null;

  let appPassword = "";
  try {
    appPassword = decryptSecret(user.mailAppPasswordEnc);
  } catch {
    // If key changed, we can't recover the secret.
    return null;
  }

  return {
    address: user.mailAddress,
    appPassword,
    imapHost: user.imapHost ?? undefined,
    imapPort: user.imapPort ?? undefined,
    imapSecure: user.imapSecure ?? undefined,
    smtpHost: user.smtpHost ?? undefined,
    smtpPort: user.smtpPort ?? undefined,
    smtpSecure: user.smtpSecure ?? undefined,
  };
}

export async function writeMailSettings(
  session: IronSession<SessionData>,
  next: MailSettings,
): Promise<void> {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (prisma && userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mailAddress: next.address,
        mailAppPasswordEnc: encryptSecret(next.appPassword),
        imapHost: next.imapHost ?? null,
        imapPort: next.imapPort ?? null,
        imapSecure: next.imapSecure ?? null,
        smtpHost: next.smtpHost ?? null,
        smtpPort: next.smtpPort ?? null,
        smtpSecure: next.smtpSecure ?? null,
      },
    });
  }

  // Keep session in sync for now (backward compatibility).
  session.mail = next;
  await session.save();
}

export async function clearMailSettings(
  session: IronSession<SessionData>,
): Promise<void> {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (prisma && userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mailAddress: null,
        mailAppPasswordEnc: null,
        imapHost: null,
        imapPort: null,
        imapSecure: null,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: null,
      },
    });
  }

  session.mail = undefined;
  await session.save();
}

export async function readUiSettings(session: IronSession<SessionData>) {
  try {
    const userId = await ensureDbUser(session);
    if (!prisma || !userId) return session.ui ?? {};

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const dbBackground =
      user?.uiBackground === null
        ? undefined
        : ((user?.uiBackground as any) ?? undefined);
    const ui = {
      theme: (user?.uiTheme as any) ?? session.ui?.theme,
      texture: (user?.uiTexture as any) ?? session.ui?.texture,
      background: dbBackground ?? session.ui?.background,
      language: (user?.uiLanguage as any) ?? session.ui?.language,
    };

    return ui;
  } catch (error) {
    console.error("[readUiSettings] falling back to session UI", error);
    return session.ui ?? {};
  }
}

export async function writeUiSettings(
  session: IronSession<SessionData>,
  next: Omit<Partial<NonNullable<SessionData["ui"]>>, "background"> & {
    background?: UiBackground | null;
  },
): Promise<void> {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (prisma && userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        uiTheme: next.theme ?? undefined,
        uiTexture: next.texture ?? undefined,
        uiLanguage: next.language ?? undefined,
        uiBackground:
          next.background === undefined
            ? undefined
            : ((next.background === null ? null : next.background) as any),
      },
    });
  }

  const merged = { ...(session.ui || {}), ...next } as any;
  if (next.background === null) {
    delete merged.background;
  }
  session.ui = merged;
  await session.save();
}

export async function hydrateSessionMail(session: IronSession<SessionData>) {
  if (session.mail?.address && session.mail?.appPassword) return;
  const mail = await readMailSettings(session);
  if (mail?.address && mail.appPassword) {
    session.mail = mail;
  }
}

export async function hydrateSessionUi(session: IronSession<SessionData>) {
  const ui = await readUiSettings(session);
  session.ui = { ...(session.ui || {}), ...ui };
}

export async function hydrateSessionSpaces(session: IronSession<SessionData>) {
  const { spaces, spaceEmails } = await readSpaces(session);
  session.spaces = spaces;
  session.spaceEmails = spaceEmails;
}

export async function readContacts(
  session: IronSession<SessionData>,
): Promise<Contact[]> {
  // Route handlers are allowed to write cookies; enabling this makes DB-backed
  // contacts available immediately without requiring a prior mutation.
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) {
    return Array.isArray(session.contacts) ? session.contacts : [];
  }

  const list = await prisma.contact.findMany({
    where: { userId },
    orderBy: [{ favorite: "desc" }, { email: "asc" }],
    select: {
      email: true,
      favorite: true,
      avatarUrl: true,
      avatarContentType: true,
      avatarUpdatedAt: true,
      createdAt: true,
    },
  });

  return list.map(
    (c: {
      email: string;
      favorite: boolean;
      avatarUrl: string | null;
      avatarContentType: string | null;
      avatarUpdatedAt: Date | null;
      createdAt: Date;
    }) => ({
      email: c.email,
      favorite: c.favorite,
      avatarUrl:
        c.avatarUpdatedAt && c.avatarContentType
          ? `/api/contacts/avatar?email=${encodeURIComponent(c.email)}&v=${encodeURIComponent(String(c.avatarUpdatedAt.getTime()))}`
          : (c.avatarUrl ?? undefined),
      createdAt: c.createdAt.getTime(),
    }),
  );
}

export async function upsertContactAvatar(
  session: IronSession<SessionData>,
  input: {
    email: string;
    data: Uint8Array<ArrayBuffer>;
    contentType: string;
  },
): Promise<void> {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) {
    throw new Error("Persistence disabled");
  }

  const existingCount = await prisma.contact.count({ where: { userId } });
  const alreadyExists = await prisma.contact.findUnique({
    where: { userId_email: { userId, email: input.email } },
    select: { id: true },
  });
  if (!alreadyExists && existingCount >= 200) {
    throw new Error("Too many contacts");
  }

  const now = new Date();
  await prisma.contact.upsert({
    where: { userId_email: { userId, email: input.email } },
    create: {
      userId,
      email: input.email,
      favorite: false,
      avatarUrl: null,
      avatarData: input.data,
      avatarContentType: input.contentType,
      avatarUpdatedAt: now,
      createdAt: now,
    },
    update: {
      avatarUrl: null,
      avatarData: input.data,
      avatarContentType: input.contentType,
      avatarUpdatedAt: now,
    },
  });
}

export async function upsertContact(
  session: IronSession<SessionData>,
  input: { email: string; favorite?: boolean; avatarUrl?: string | null },
): Promise<Contact[]> {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) {
    const contacts = Array.isArray(session.contacts) ? session.contacts : [];
    const exists = contacts.some((c) => c.email === input.email);
    const next = exists
      ? contacts.map((c) =>
          c.email === input.email
            ? {
                ...c,
                favorite: input.favorite ?? c.favorite,
                avatarUrl:
                  input.avatarUrl === undefined
                    ? (c as any).avatarUrl
                    : (input.avatarUrl ?? undefined),
              }
            : c,
        )
      : [
          ...contacts,
          {
            email: input.email,
            favorite: input.favorite ?? false,
            avatarUrl: input.avatarUrl ?? undefined,
            createdAt: Date.now(),
          },
        ];

    session.contacts = next;
    await session.save();
    return next;
  }

  await prisma.contact.upsert({
    where: { userId_email: { userId, email: input.email } },
    create: {
      userId,
      email: input.email,
      favorite: Boolean(input.favorite),
      avatarUrl: input.avatarUrl ?? null,
      createdAt: new Date(),
    },
    update: {
      favorite:
        input.favorite === undefined ? undefined : Boolean(input.favorite),
      avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl,
    },
  });

  return readContacts(session);
}

export async function deleteContact(
  session: IronSession<SessionData>,
  email: string,
): Promise<Contact[]> {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) {
    const contacts = Array.isArray(session.contacts) ? session.contacts : [];
    const next = contacts.filter((c) => c.email !== email);
    session.contacts = next;
    await session.save();
    return next;
  }

  await prisma.contact.deleteMany({ where: { userId, email } });
  return readContacts(session);
}

export async function ensureDefaultSpaceDb(session: IronSession<SessionData>) {
  try {
    const userId = await ensureDbUser(session);
    if (!prisma || !userId) return;

    const principalId = "principal";
    const exists = await prisma.space.findFirst({
      where: { userId, id: principalId },
      select: { id: true },
    });
    if (exists) return;

    await prisma.space.create({
      data: {
        id: principalId,
        userId,
        name: "Principal",
        icon: "📥",
        color: "#3B82F6",
        bgColor: "#F0F4FF",
        textColor: "#1E293B",
        mailFontSize: 14,
        createdAt: new Date(),
      },
    });

    // Initialize principal mailboxes in JSON state if absent.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.spaceEmails == null) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          spaceEmails: {
            principal: {
              INBOX: [],
              SENT: [],
              DRAFTS: [],
              "[Gmail]/Spam": [],
              "[Gmail]/Trash": [],
            },
          } as any,
        },
      });
    }
  } catch (error) {
    console.error("[ensureDefaultSpaceDb] skipped", error);
  }
}

export async function readSpaces(session: IronSession<SessionData>): Promise<{
  spaces: Space[];
  spaceEmails: Record<string, Record<string, string[]>>;
}> {
  try {
    const userId = await ensureDbUser(session);
    if (!prisma || !userId) {
      return {
        spaces: Array.isArray(session.spaces) ? session.spaces : [],
        spaceEmails: (session.spaceEmails ?? {}) as any,
      };
    }

    await ensureDefaultSpaceDb(session);

    const spaces = await prisma.space.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }],
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const spaceEmails = (user?.spaceEmails ?? {}) as any;

    return {
      spaces: spaces.map((s: any) => ({
        id: s.id,
        name: s.name,
        color: s.color ?? undefined,
        icon: s.icon ?? undefined,
        bgColor: s.bgColor ?? undefined,
        columnBgColor: s.columnBgColor ?? undefined,
        columnBackground: (s.columnBackground as any) ?? undefined,
        textColor: s.textColor ?? undefined,
        buttonBgColor: s.buttonBgColor ?? undefined,
        mailFont: (s.mailFont as any) ?? undefined,
        mailFontSize:
          typeof s.mailFontSize === "number" ? s.mailFontSize : undefined,
        railGradientFrom: s.railGradientFrom ?? undefined,
        railGradientTo: s.railGradientTo ?? undefined,
        appBackground: (s.appBackground as any) ?? undefined,
        createdAt: s.createdAt,
      })),
      spaceEmails,
    };
  } catch (error) {
    console.error("[readSpaces] falling back to session spaces", error);
    return {
      spaces: Array.isArray(session.spaces) ? session.spaces : [],
      spaceEmails: (session.spaceEmails ?? {}) as any,
    };
  }
}

export async function createSpace(
  session: IronSession<SessionData>,
  input: { name: string; color?: string; bgColor?: string; icon?: string },
) {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) return null;

  const id = crypto.randomUUID();
  const created = await prisma.space.create({
    data: {
      id,
      userId,
      name: input.name,
      color: input.color ?? "#3B82F6",
      bgColor: input.bgColor ?? "#F0F4FF",
      textColor: "#1E293B",
      mailFontSize: 14,
      icon: input.icon ?? "📁",
    },
  });

  // Ensure spaceEmails has mailbox buckets
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const next = {
    ...(user?.spaceEmails as any),
    [id]: {
      INBOX: [],
      SENT: [],
      DRAFTS: [],
      "[Gmail]/Spam": [],
      "[Gmail]/Trash": [],
    },
  };
  await prisma.user.update({
    where: { id: userId },
    data: { spaceEmails: next },
  });

  return {
    id: created.id,
    name: created.name,
    color: created.color ?? undefined,
    bgColor: created.bgColor ?? undefined,
    textColor: created.textColor ?? undefined,
    icon: created.icon ?? undefined,
    createdAt: created.createdAt,
  } as Space;
}

export async function updateSpace(
  session: IronSession<SessionData>,
  id: string,
  data: Partial<Space> & {
    columnBgColor?: string | null;
    columnBackground?: UiBackground | null;
    buttonBgColor?: string | null;
    mailFontSize?: number | null;
    railGradientFrom?: string | null;
    railGradientTo?: string | null;
    appBackground?: UiBackground | null;
  },
) {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) return null;

  const asNullable = <T>(v: T | null | undefined): T | null | undefined =>
    v === undefined ? undefined : v === null ? null : v;

  const updated = await prisma.space.updateMany({
    where: { userId, id },
    data: {
      name: data.name ?? undefined,
      color: data.color ?? undefined,
      icon: data.icon ?? undefined,
      bgColor: data.bgColor ?? undefined,
      columnBgColor: asNullable((data as any).columnBgColor),
      columnBackground: asNullable((data as any).columnBackground) as any,
      textColor: asNullable((data as any).textColor),
      buttonBgColor: asNullable((data as any).buttonBgColor),
      mailFont: (data as any).mailFont ?? undefined,
      mailFontSize: asNullable((data as any).mailFontSize),
      railGradientFrom: asNullable((data as any).railGradientFrom),
      railGradientTo: asNullable((data as any).railGradientTo),
      appBackground: asNullable((data as any).appBackground) as any,
    },
  });

  return updated.count > 0;
}

export async function deleteSpace(
  session: IronSession<SessionData>,
  id: string,
) {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) return false;

  if (id === "principal") return false;

  await prisma.space.deleteMany({ where: { userId, id } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const emails = { ...(user?.spaceEmails as any) };
  delete emails[id];
  await prisma.user.update({
    where: { id: userId },
    data: { spaceEmails: emails },
  });
  return true;
}

export async function addEmailToSpaceMailbox(
  session: IronSession<SessionData>,
  spaceId: string,
  mailbox: string,
  emailId: string,
) {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const current = ((user?.spaceEmails ?? {}) as any) ?? {};
  const boxMap = (current[spaceId] ?? {}) as any;
  const list = Array.isArray(boxMap[mailbox]) ? boxMap[mailbox] : [];
  if (!list.includes(emailId)) list.unshift(emailId);

  const next = {
    ...current,
    [spaceId]: {
      ...boxMap,
      [mailbox]: list,
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { spaceEmails: next },
  });
  return next;
}

export async function removeEmailFromSpaceMailbox(
  session: IronSession<SessionData>,
  spaceId: string,
  mailbox: string,
  emailId: string,
) {
  const userId = await ensureDbUser(session, { allowCookieWrite: true });
  if (!prisma || !userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const current = ((user?.spaceEmails ?? {}) as any) ?? {};
  const boxMap = (current[spaceId] ?? {}) as any;
  const list = Array.isArray(boxMap[mailbox]) ? boxMap[mailbox] : [];
  const nextList = list.filter((id: string) => id !== emailId);

  const next = {
    ...current,
    [spaceId]: {
      ...boxMap,
      [mailbox]: nextList,
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { spaceEmails: next },
  });
  return next;
}
