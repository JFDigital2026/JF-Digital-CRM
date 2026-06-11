-- Add CUSTOM to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- Add columns to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "firstName"       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastName"        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "active"          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "permissions"     JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "department"      TEXT,
  ADD COLUMN IF NOT EXISTS "title"           TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl"       TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastLoginAt"     TIMESTAMP(3);

-- Backfill firstName/lastName from existing name field
UPDATE "User"
SET
  "firstName" = COALESCE(SPLIT_PART("name", ' ', 1), ''),
  "lastName"  = CASE
    WHEN POSITION(' ' IN COALESCE("name", '')) > 0
    THEN SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)
    ELSE ''
  END
WHERE "firstName" = '';

-- FK constraint for createdByUserId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_active_idx" ON "User"("active");
