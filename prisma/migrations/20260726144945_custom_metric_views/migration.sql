-- CreateTable
CREATE TABLE "MetricView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricViewItem" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "showTrend" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MetricViewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundDailyStat" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "uniqueOpens" INTEGER NOT NULL DEFAULT 0,
    "totalOpens" INTEGER NOT NULL DEFAULT 0,
    "suppressedOpens" INTEGER NOT NULL DEFAULT 0,
    "replied" INTEGER NOT NULL DEFAULT 0,
    "optedOut" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "linkedinSent" INTEGER NOT NULL DEFAULT 0,
    "windowSent" INTEGER,
    "windowDays" INTEGER,
    "byInbox" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricTarget" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'month',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetricView_slug_key" ON "MetricView"("slug");

-- CreateIndex
CREATE INDEX "MetricView_ownerId_idx" ON "MetricView"("ownerId");

-- CreateIndex
CREATE INDEX "MetricView_order_idx" ON "MetricView"("order");

-- CreateIndex
CREATE INDEX "MetricViewItem_viewId_idx" ON "MetricViewItem"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricViewItem_viewId_metricId_key" ON "MetricViewItem"("viewId", "metricId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundDailyStat_date_key" ON "OutboundDailyStat"("date");

-- CreateIndex
CREATE INDEX "OutboundDailyStat_date_idx" ON "OutboundDailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricTarget_metricId_key" ON "MetricTarget"("metricId");

-- CreateIndex
CREATE INDEX "MetricTarget_metricId_idx" ON "MetricTarget"("metricId");

-- AddForeignKey
ALTER TABLE "MetricView" ADD CONSTRAINT "MetricView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricViewItem" ADD CONSTRAINT "MetricViewItem_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "MetricView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
