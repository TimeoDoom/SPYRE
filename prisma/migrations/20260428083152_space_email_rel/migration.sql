-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "mailAddress" TEXT,
    "mailAppPasswordEnc" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecure" BOOLEAN,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN,
    "uiTheme" TEXT,
    "uiTexture" TEXT,
    "uiBackground" JSONB,
    "uiLanguage" TEXT,
    "spaceEmails" JSONB
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "bgColor" TEXT,
    "columnBgColor" TEXT,
    "columnBackground" JSONB,
    "textColor" TEXT,
    "buttonBgColor" TEXT,
    "mailFont" TEXT,
    "mailFontSize" INTEGER,
    "railGradientFrom" TEXT,
    "railGradientTo" TEXT,
    "appBackground" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "Space_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpaceEmail" (
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "spaceId", "mailbox", "emailId"),
    CONSTRAINT "SpaceEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpaceEmail_userId_spaceId_fkey" FOREIGN KEY ("userId", "spaceId") REFERENCES "Space" ("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "avatarData" BLOB,
    "avatarContentType" TEXT,
    "avatarUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Space_userId_idx" ON "Space"("userId");

-- CreateIndex
CREATE INDEX "SpaceEmail_userId_spaceId_idx" ON "SpaceEmail"("userId", "spaceId");

-- CreateIndex
CREATE INDEX "SpaceEmail_userId_emailId_idx" ON "SpaceEmail"("userId", "emailId");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_email_key" ON "Contact"("userId", "email");
