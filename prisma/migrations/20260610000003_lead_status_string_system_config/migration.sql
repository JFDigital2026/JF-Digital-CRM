-- Convert leadStatus from enum to text
ALTER TABLE "Contact" ALTER COLUMN "leadStatus" TYPE TEXT USING "leadStatus"::TEXT;
ALTER TABLE "Contact" ALTER COLUMN "leadStatus" SET DEFAULT 'NEW';

-- Drop the old LeadStatus enum
DROP TYPE IF EXISTS "LeadStatus";

-- CreateTable SystemConfig
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_userId_key_key" ON "SystemConfig"("userId", "key");

-- CreateIndex
CREATE INDEX "SystemConfig_userId_idx" ON "SystemConfig"("userId");

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
