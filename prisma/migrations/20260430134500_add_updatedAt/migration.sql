-- Add updatedAt to Space and Contact with a constant default so ALTER works,
-- then backfill using CURRENT_TIMESTAMP for existing rows.

ALTER TABLE "Space" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE "Contact" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

-- Backfill to current timestamp for existing rows
UPDATE "Space" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" = '1970-01-01T00:00:00.000Z';
UPDATE "Contact" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" = '1970-01-01T00:00:00.000Z';
