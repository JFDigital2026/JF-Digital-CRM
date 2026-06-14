-- Set default empty array on Contact.tags and backfill existing NULLs
ALTER TABLE "Contact" ALTER COLUMN "tags" SET DEFAULT '{}';
UPDATE "Contact" SET "tags" = '{}' WHERE "tags" IS NULL;
