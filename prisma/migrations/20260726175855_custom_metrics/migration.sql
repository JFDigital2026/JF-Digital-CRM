-- CreateEnum
CREATE TYPE "MetricAggregation" AS ENUM ('SUM', 'AVERAGE', 'LATEST', 'MAX', 'MIN');

-- CreateEnum
CREATE TYPE "MetricValueSource" AS ENUM ('MANUAL', 'API');

-- CreateTable
CREATE TABLE "CustomMetric" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "unit" TEXT NOT NULL DEFAULT 'number',
    "description" TEXT NOT NULL DEFAULT '',
    "aggregation" "MetricAggregation" NOT NULL DEFAULT 'SUM',
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomMetricValue" (
    "id" TEXT NOT NULL,
    "customMetricId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "source" "MetricValueSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomMetricValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomMetric_key_key" ON "CustomMetric"("key");

-- CreateIndex
CREATE INDEX "CustomMetric_key_idx" ON "CustomMetric"("key");

-- CreateIndex
CREATE INDEX "CustomMetric_category_idx" ON "CustomMetric"("category");

-- CreateIndex
CREATE INDEX "CustomMetricValue_customMetricId_idx" ON "CustomMetricValue"("customMetricId");

-- CreateIndex
CREATE INDEX "CustomMetricValue_date_idx" ON "CustomMetricValue"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CustomMetricValue_customMetricId_date_key" ON "CustomMetricValue"("customMetricId", "date");

-- AddForeignKey
ALTER TABLE "CustomMetric" ADD CONSTRAINT "CustomMetric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMetricValue" ADD CONSTRAINT "CustomMetricValue_customMetricId_fkey" FOREIGN KEY ("customMetricId") REFERENCES "CustomMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
