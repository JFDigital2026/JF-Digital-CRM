-- Aligns DB with schema.prisma; closes drift introduced by hand-written migration SQL.
-- Verified against prod 2026-07-02: no User rows have role 'USER', so the enum
-- recreate is safe without data migration.

-- AlterEnum: drop unused 'USER' variant (init migration created ('ADMIN','USER');
-- schema.prisma never included USER)
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'MANAGER', 'SALES_REP', 'SUPPORT', 'CUSTOM');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- AlterTable: role default was ADMIN since init — schema.prisma says SALES_REP.
-- Any insert bypassing Prisma would have minted an admin.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SALES_REP';

-- AlterTable: ids are Prisma-side @default(cuid()); DB-level uuid defaults were
-- hand-added in 20260610000004 and never in schema.prisma
ALTER TABLE "EmailSignature" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "EmailTemplate" ALTER COLUMN "id" DROP DEFAULT;
