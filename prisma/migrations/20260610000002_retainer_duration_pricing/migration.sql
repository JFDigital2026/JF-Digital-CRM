-- AlterTable: add duration tier prices to Product
ALTER TABLE "Product" ADD COLUMN "price6Month" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "price12Month" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "price18Month" DOUBLE PRECISION;

-- AlterTable: add duration tracking to Subscription
ALTER TABLE "Subscription" ADD COLUMN "durationMonths" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "endDate" TIMESTAMP(3);
