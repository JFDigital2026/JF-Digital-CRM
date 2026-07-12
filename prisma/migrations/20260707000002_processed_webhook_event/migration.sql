-- Idempotency ledger for inbound provider webhooks (Stripe et al.). The handler
-- inserts the provider event id before doing any work and treats a duplicate-key
-- violation as "already processed", so at-least-once redelivery can't create
-- duplicate invoices, re-fire automations, or double-send notifications.
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessedWebhookEvent_createdAt_idx" ON "ProcessedWebhookEvent" ("createdAt");
