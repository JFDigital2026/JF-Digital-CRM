-- Add missing Role enum values (USER was the original, keep it; add the real ones)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES_REP';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPORT';

-- Fix User.role default + add Google OAuth fields
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SALES_REP';
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "googleAccessToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "googleRefreshToken"  TEXT,
  ADD COLUMN IF NOT EXISTS "googleCalendarEmail" TEXT;

-- Enums
CREATE TYPE "CustomFieldType"       AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');
CREATE TYPE "CalendarEventStatus"   AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "TaskStatus"            AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "TaskPriority"          AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "MessageDirection"      AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageChannel"        AS ENUM ('EMAIL', 'SMS', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN');
CREATE TYPE "ProductType"           AS ENUM ('ONE_TIME', 'SUBSCRIPTION', 'PAYMENT_PLAN');
CREATE TYPE "ProductInterval"       AS ENUM ('BI_WEEKLY', 'MONTHLY', 'ANNUAL', 'YEARLY', 'CUSTOM');
CREATE TYPE "PaymentFrequency"      AS ENUM ('BI_WEEKLY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "InvoiceStatus"         AS ENUM ('DRAFT', 'SENT', 'PAID');
CREATE TYPE "OrderStatus"           AS ENUM ('PAID', 'PENDING', 'FAILED', 'REFUNDED', 'PENDING_COMPLETION');
CREATE TYPE "SubscriptionStatus"    AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'PENDING');
CREATE TYPE "AutomationLogStatus"   AS ENUM ('SUCCESS', 'FAILURE', 'SKIPPED');
CREATE TYPE "AutomationQueueStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "OpportunityOutcome"    AS ENUM ('WON', 'LOST', 'ABANDONED');
CREATE TYPE "NotificationType"      AS ENUM ('APPOINTMENT_BOOKED', 'FORM_SUBMITTED', 'MESSAGE_RECEIVED', 'TASK_DUE', 'PAYMENT_MADE', 'AUTOMATION_FAILED');

-- CustomValue
CREATE TABLE "CustomValue" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomValue_pkey" PRIMARY KEY ("id")
);

-- ApiKey
CREATE TABLE "ApiKey" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "hashedKey"    TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "scopes"       TEXT[],
    "lastUsed"     TIMESTAMP(3),
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- ApiLog
CREATE TABLE "ApiLog" (
    "id"         TEXT NOT NULL,
    "apiKeyId"   TEXT NOT NULL,
    "endpoint"   TEXT NOT NULL,
    "method"     TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- WebhookEndpoint
CREATE TABLE "WebhookEndpoint" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "events"    TEXT[],
    "secret"    TEXT NOT NULL,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- WebhookLog
CREATE TABLE "WebhookLog" (
    "id"                TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "event"             TEXT NOT NULL,
    "payload"           JSONB NOT NULL,
    "statusCode"        INTEGER,
    "attempt"           INTEGER NOT NULL DEFAULT 1,
    "success"           BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- Company
CREATE TABLE "Company" (
    "id"                 TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "website"            TEXT,
    "industry"           TEXT,
    "companySize"        TEXT,
    "location"           TEXT,
    "address"            TEXT,
    "city"               TEXT,
    "state"              TEXT,
    "zip"                TEXT,
    "country"            TEXT,
    "timezone"           TEXT,
    "notes"              TEXT,
    "lastProjectSummary" TEXT,
    "lastProjectDate"    TIMESTAMP(3),
    "hierarchyJson"      JSONB,
    "stripeCustomerId"   TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- Contact (leadStatus as TEXT — migration 000003 will convert it from enum, but we skip the enum entirely)
CREATE TABLE "Contact" (
    "id"           TEXT NOT NULL,
    "firstName"    TEXT NOT NULL,
    "lastName"     TEXT NOT NULL,
    "email"        TEXT,
    "phone"        TEXT,
    "title"        TEXT,
    "role"         TEXT,
    "companyId"    TEXT,
    "leadStatus"   TEXT NOT NULL DEFAULT 'NEW',
    "source"       TEXT,
    "tags"         TEXT[],
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl"    TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CustomField
CREATE TABLE "CustomField" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "type"      "CustomFieldType" NOT NULL,
    "options"   TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CustomFieldValue
CREATE TABLE "CustomFieldValue" (
    "id"            TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "contactId"     TEXT NOT NULL,
    "value"         TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- Pipeline
CREATE TABLE "Pipeline" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- Stage
CREATE TABLE "Stage" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "order"      INTEGER NOT NULL,
    "color"      TEXT,
    "pipelineId" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- Opportunity
CREATE TABLE "Opportunity" (
    "id"            TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "value"         DOUBLE PRECISION,
    "probability"   DOUBLE PRECISION,
    "closeDate"     TIMESTAMP(3),
    "contactId"     TEXT,
    "companyId"     TEXT,
    "stageId"       TEXT NOT NULL,
    "pipelineId"    TEXT NOT NULL,
    "assignedTo"    TEXT,
    "notes"         TEXT,
    "outcome"       "OpportunityOutcome",
    "wonAmount"     DOUBLE PRECISION,
    "outcomeReason" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CalendarConfig
CREATE TABLE "CalendarConfig" (
    "id"                      TEXT NOT NULL,
    "name"                    TEXT NOT NULL,
    "slug"                    TEXT NOT NULL,
    "type"                    TEXT NOT NULL,
    "duration"                INTEGER NOT NULL,
    "bufferTime"              INTEGER NOT NULL DEFAULT 0,
    "timezone"                TEXT NOT NULL,
    "availabilityJson"        JSONB NOT NULL,
    "roundRobin"              BOOLEAN NOT NULL DEFAULT false,
    "confirmationMessage"     TEXT,
    "reminderTiming"          TEXT[],
    "userId"                  TEXT NOT NULL,
    "active"                  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description"             TEXT,
    "maxBookingsPerDay"       INTEGER DEFAULT 10,
    "googleAccessToken"       TEXT,
    "googleRefreshToken"      TEXT,
    "googleConnectedEmail"    TEXT,
    "googleSyncDirection"     TEXT DEFAULT 'read-only',
    "meetingInterval"         INTEGER DEFAULT 15,
    "meetingIntervalUnit"     TEXT DEFAULT 'minutes',
    "minSchedulingNotice"     INTEGER DEFAULT 15,
    "minSchedulingNoticeUnit" TEXT DEFAULT 'minutes',
    "dateRange"               INTEGER DEFAULT 60,
    "dateRangeUnit"           TEXT DEFAULT 'days',
    "preBufferTime"           INTEGER DEFAULT 0,
    "maxBookingsPerSlot"      INTEGER DEFAULT 1,
    "lookBusy"                BOOLEAN DEFAULT false,
    "lookBusyPercent"         INTEGER DEFAULT 0,
    "meetingDistribution"     TEXT DEFAULT 'availability',
    "meetingLocations"        JSONB,
    "meetingInviteTitle"      TEXT,
    "meetingColor"            TEXT DEFAULT '#415A77',
    "group"                   TEXT,
    CONSTRAINT "CalendarConfig_pkey" PRIMARY KEY ("id")
);

-- CalendarEvent
CREATE TABLE "CalendarEvent" (
    "id"               TEXT NOT NULL,
    "calendarConfigId" TEXT NOT NULL,
    "contactId"        TEXT,
    "userId"           TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "startTime"        TIMESTAMP(3) NOT NULL,
    "endTime"          TIMESTAMP(3) NOT NULL,
    "status"           "CalendarEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes"            TEXT,
    "reminderSent"     BOOLEAN NOT NULL DEFAULT false,
    "googleEventId"    TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- TaskTemplate
CREATE TABLE "TaskTemplate" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "tasks"     JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- Task
CREATE TABLE "Task" (
    "id"             TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "dueDate"        TIMESTAMP(3),
    "status"         "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority"       "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "contactId"      TEXT,
    "companyId"      TEXT,
    "assignedTo"     TEXT,
    "isRecurring"    BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "followUpTaskId" TEXT,
    "templateId"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- Message
CREATE TABLE "Message" (
    "id"         TEXT NOT NULL,
    "contactId"  TEXT NOT NULL,
    "direction"  "MessageDirection" NOT NULL,
    "channel"    "MessageChannel" NOT NULL,
    "subject"    TEXT,
    "body"       TEXT NOT NULL,
    "read"       BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- ConversationNote
CREATE TABLE "ConversationNote" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

-- Product (price6Month/12Month/18Month added by migration 000002)
CREATE TABLE "Product" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "type"            "ProductType" NOT NULL,
    "price"           DOUBLE PRECISION NOT NULL,
    "interval"        "ProductInterval",
    "trialDays"       INTEGER,
    "planCount"       INTEGER,
    "planAmount"      DOUBLE PRECISION,
    "paymentFrequency" "PaymentFrequency",
    "intervalCount"   INTEGER,
    "intervalUnit"    TEXT,
    "setupFee"        DOUBLE PRECISION,
    "stripePriceId"   TEXT,
    "stripeProductId" TEXT,
    "active"          BOOLEAN NOT NULL DEFAULT true,
    "archivedAt"      TIMESTAMP(3),
    "userId"          TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- Order
CREATE TABLE "Order" (
    "id"                    TEXT NOT NULL,
    "contactId"             TEXT,
    "companyId"             TEXT,
    "productId"             TEXT NOT NULL,
    "amount"                DOUBLE PRECISION NOT NULL,
    "currency"              TEXT NOT NULL DEFAULT 'usd',
    "status"                "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId"       TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- Subscription (durationMonths/endDate added by migration 000002)
CREATE TABLE "Subscription" (
    "id"                 TEXT NOT NULL,
    "contactId"          TEXT,
    "companyId"          TEXT,
    "productId"          TEXT NOT NULL,
    "stripeSubId"        TEXT,
    "stripeCustomerId"   TEXT,
    "status"             "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthsActive"       INTEGER NOT NULL DEFAULT 0,
    "nextBillingDate"    TIMESTAMP(3),
    "scheduledStartDate" TIMESTAMP(3),
    "customAmount"       DOUBLE PRECISION,
    "cancelledAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Invoice
CREATE TABLE "Invoice" (
    "id"        TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "number"    TEXT NOT NULL,
    "amount"    DOUBLE PRECISION NOT NULL,
    "currency"  TEXT NOT NULL DEFAULT 'usd',
    "status"    "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl"    TEXT,
    "sentAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Coupon
CREATE TABLE "Coupon" (
    "id"         TEXT NOT NULL,
    "stripeId"   TEXT NOT NULL,
    "productId"  TEXT,
    "name"       TEXT NOT NULL,
    "code"       TEXT,
    "percentOff" DOUBLE PRECISION,
    "amountOff"  DOUBLE PRECISION,
    "currency"   TEXT,
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "expiresAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- Automation
CREATE TABLE "Automation" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "sourceFile"    TEXT,
    "trigger"       TEXT NOT NULL,
    "triggerConfig" JSONB,
    "conditions"    JSONB NOT NULL DEFAULT '[]',
    "steps"         JSONB NOT NULL DEFAULT '[]',
    "copyOverrides" JSONB,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "syncStatus"    TEXT NOT NULL DEFAULT 'SYNCED',
    "lastSyncedAt"  TIMESTAMP(3),
    "userId"        TEXT NOT NULL,
    "lastRunAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- AutomationLog
CREATE TABLE "AutomationLog" (
    "id"             TEXT NOT NULL,
    "automationId"   TEXT NOT NULL,
    "contactId"      TEXT,
    "status"         "AutomationLogStatus" NOT NULL,
    "error"          TEXT,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "duration"       INTEGER,
    "stepLogs"       JSONB,
    "executedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- AutomationQueue
CREATE TABLE "AutomationQueue" (
    "id"            TEXT NOT NULL,
    "automationId"  TEXT NOT NULL,
    "contactId"     TEXT,
    "nextStepId"    TEXT,
    "actionPayload" JSONB NOT NULL DEFAULT '{}',
    "executeAt"     TIMESTAMP(3) NOT NULL,
    "status"        "AutomationQueueStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationQueue_pkey" PRIMARY KEY ("id")
);

-- FileAttachment
CREATE TABLE "FileAttachment" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "url"        TEXT NOT NULL,
    "size"       INTEGER NOT NULL,
    "type"       TEXT NOT NULL,
    "contactId"  TEXT,
    "companyId"  TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- Notification
CREATE TABLE "Notification" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      "NotificationType" NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "read"      BOOLEAN NOT NULL DEFAULT false,
    "linkUrl"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- ActivityLog
CREATE TABLE "ActivityLog" (
    "id"            TEXT NOT NULL,
    "contactId"     TEXT,
    "companyId"     TEXT,
    "opportunityId" TEXT,
    "userId"        TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "description"   TEXT NOT NULL,
    "metadata"      JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- AIConversation
CREATE TABLE "AIConversation" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "title"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- AIMessage
CREATE TABLE "AIMessage" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- MetricSnapshot
CREATE TABLE "MetricSnapshot" (
    "id"                 TEXT NOT NULL,
    "date"               TIMESTAMP(3) NOT NULL,
    "mrr"                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "arr"                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newContacts"        INTEGER NOT NULL DEFAULT 0,
    "openOpportunities"  INTEGER NOT NULL DEFAULT 0,
    "closedWon"          INTEGER NOT NULL DEFAULT 0,
    "closedLost"         INTEGER NOT NULL DEFAULT 0,
    "avgDealSize"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "appointmentsBooked" INTEGER NOT NULL DEFAULT 0,
    "noShows"            INTEGER NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- ─── Unique Indexes ───────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "CustomValue_userId_key_key"              ON "CustomValue"("userId", "key");
CREATE UNIQUE INDEX "ApiKey_hashedKey_key"                    ON "ApiKey"("hashedKey");
CREATE UNIQUE INDEX "CustomField_key_key"                     ON "CustomField"("key");
CREATE UNIQUE INDEX "CustomFieldValue_customFieldId_contactId_key" ON "CustomFieldValue"("customFieldId", "contactId");
CREATE UNIQUE INDEX "CalendarConfig_slug_key"                 ON "CalendarConfig"("slug");
CREATE UNIQUE INDEX "Subscription_stripeSubId_key"            ON "Subscription"("stripeSubId");
CREATE UNIQUE INDEX "Invoice_number_key"                      ON "Invoice"("number");
CREATE UNIQUE INDEX "Coupon_stripeId_key"                     ON "Coupon"("stripeId");
CREATE UNIQUE INDEX "Automation_userId_sourceFile_key"        ON "Automation"("userId", "sourceFile");
CREATE UNIQUE INDEX "MetricSnapshot_date_key"                 ON "MetricSnapshot"("date");

-- ─── Regular Indexes ─────────────────────────────────────────────────────────
CREATE INDEX "User_email_idx"                    ON "User"("email");
CREATE INDEX "CustomValue_userId_idx"            ON "CustomValue"("userId");
CREATE INDEX "ApiKey_userId_idx"                 ON "ApiKey"("userId");
CREATE INDEX "ApiKey_hashedKey_idx"              ON "ApiKey"("hashedKey");
CREATE INDEX "ApiLog_apiKeyId_idx"               ON "ApiLog"("apiKeyId");
CREATE INDEX "ApiLog_createdAt_idx"              ON "ApiLog"("createdAt");
CREATE INDEX "WebhookEndpoint_userId_idx"        ON "WebhookEndpoint"("userId");
CREATE INDEX "WebhookLog_webhookEndpointId_idx"  ON "WebhookLog"("webhookEndpointId");
CREATE INDEX "WebhookLog_createdAt_idx"          ON "WebhookLog"("createdAt");
CREATE INDEX "Company_name_idx"                  ON "Company"("name");
CREATE INDEX "Company_createdAt_idx"             ON "Company"("createdAt");
CREATE INDEX "Contact_companyId_idx"             ON "Contact"("companyId");
CREATE INDEX "Contact_email_idx"                 ON "Contact"("email");
CREATE INDEX "Contact_leadStatus_idx"            ON "Contact"("leadStatus");
CREATE INDEX "Contact_createdAt_idx"             ON "Contact"("createdAt");
CREATE INDEX "CustomField_key_idx"               ON "CustomField"("key");
CREATE INDEX "CustomFieldValue_customFieldId_idx" ON "CustomFieldValue"("customFieldId");
CREATE INDEX "CustomFieldValue_contactId_idx"    ON "CustomFieldValue"("contactId");
CREATE INDEX "Pipeline_userId_idx"               ON "Pipeline"("userId");
CREATE INDEX "Stage_pipelineId_idx"              ON "Stage"("pipelineId");
CREATE INDEX "Opportunity_contactId_idx"         ON "Opportunity"("contactId");
CREATE INDEX "Opportunity_companyId_idx"         ON "Opportunity"("companyId");
CREATE INDEX "Opportunity_stageId_idx"           ON "Opportunity"("stageId");
CREATE INDEX "Opportunity_pipelineId_idx"        ON "Opportunity"("pipelineId");
CREATE INDEX "Opportunity_assignedTo_idx"        ON "Opportunity"("assignedTo");
CREATE INDEX "Opportunity_createdAt_idx"         ON "Opportunity"("createdAt");
CREATE INDEX "CalendarConfig_userId_idx"         ON "CalendarConfig"("userId");
CREATE INDEX "CalendarConfig_slug_idx"           ON "CalendarConfig"("slug");
CREATE INDEX "CalendarEvent_calendarConfigId_idx" ON "CalendarEvent"("calendarConfigId");
CREATE INDEX "CalendarEvent_contactId_idx"       ON "CalendarEvent"("contactId");
CREATE INDEX "CalendarEvent_userId_idx"          ON "CalendarEvent"("userId");
CREATE INDEX "CalendarEvent_startTime_idx"       ON "CalendarEvent"("startTime");
CREATE INDEX "CalendarEvent_status_idx"          ON "CalendarEvent"("status");
CREATE INDEX "Task_contactId_idx"                ON "Task"("contactId");
CREATE INDEX "Task_companyId_idx"                ON "Task"("companyId");
CREATE INDEX "Task_assignedTo_idx"               ON "Task"("assignedTo");
CREATE INDEX "Task_status_idx"                   ON "Task"("status");
CREATE INDEX "Task_dueDate_idx"                  ON "Task"("dueDate");
CREATE INDEX "Task_followUpTaskId_idx"           ON "Task"("followUpTaskId");
CREATE INDEX "Message_contactId_idx"             ON "Message"("contactId");
CREATE INDEX "Message_channel_idx"               ON "Message"("channel");
CREATE INDEX "Message_read_idx"                  ON "Message"("read");
CREATE INDEX "Message_createdAt_idx"             ON "Message"("createdAt");
CREATE INDEX "ConversationNote_contactId_idx"    ON "ConversationNote"("contactId");
CREATE INDEX "ConversationNote_userId_idx"       ON "ConversationNote"("userId");
CREATE INDEX "Product_userId_idx"                ON "Product"("userId");
CREATE INDEX "Product_active_idx"                ON "Product"("active");
CREATE INDEX "Product_archivedAt_idx"            ON "Product"("archivedAt");
CREATE INDEX "Order_contactId_idx"               ON "Order"("contactId");
CREATE INDEX "Order_companyId_idx"               ON "Order"("companyId");
CREATE INDEX "Order_productId_idx"               ON "Order"("productId");
CREATE INDEX "Order_status_idx"                  ON "Order"("status");
CREATE INDEX "Order_createdAt_idx"               ON "Order"("createdAt");
CREATE INDEX "Subscription_contactId_idx"        ON "Subscription"("contactId");
CREATE INDEX "Subscription_companyId_idx"        ON "Subscription"("companyId");
CREATE INDEX "Subscription_productId_idx"        ON "Subscription"("productId");
CREATE INDEX "Subscription_status_idx"           ON "Subscription"("status");
CREATE INDEX "Subscription_stripeSubId_idx"      ON "Subscription"("stripeSubId");
CREATE INDEX "Invoice_orderId_idx"               ON "Invoice"("orderId");
CREATE INDEX "Invoice_contactId_idx"             ON "Invoice"("contactId");
CREATE INDEX "Invoice_number_idx"                ON "Invoice"("number");
CREATE INDEX "Invoice_status_idx"                ON "Invoice"("status");
CREATE INDEX "Coupon_stripeId_idx"               ON "Coupon"("stripeId");
CREATE INDEX "Coupon_productId_idx"              ON "Coupon"("productId");
CREATE INDEX "Coupon_active_idx"                 ON "Coupon"("active");
CREATE INDEX "Automation_userId_idx"             ON "Automation"("userId");
CREATE INDEX "Automation_active_idx"             ON "Automation"("active");
CREATE INDEX "Automation_sourceFile_idx"         ON "Automation"("sourceFile");
CREATE INDEX "AutomationLog_automationId_idx"    ON "AutomationLog"("automationId");
CREATE INDEX "AutomationLog_contactId_idx"       ON "AutomationLog"("contactId");
CREATE INDEX "AutomationLog_executedAt_idx"      ON "AutomationLog"("executedAt");
CREATE INDEX "AutomationQueue_automationId_idx"  ON "AutomationQueue"("automationId");
CREATE INDEX "AutomationQueue_contactId_idx"     ON "AutomationQueue"("contactId");
CREATE INDEX "AutomationQueue_executeAt_idx"     ON "AutomationQueue"("executeAt");
CREATE INDEX "AutomationQueue_status_idx"        ON "AutomationQueue"("status");
CREATE INDEX "FileAttachment_contactId_idx"      ON "FileAttachment"("contactId");
CREATE INDEX "FileAttachment_companyId_idx"      ON "FileAttachment"("companyId");
CREATE INDEX "FileAttachment_uploadedBy_idx"     ON "FileAttachment"("uploadedBy");
CREATE INDEX "Notification_userId_idx"           ON "Notification"("userId");
CREATE INDEX "Notification_read_idx"             ON "Notification"("read");
CREATE INDEX "Notification_createdAt_idx"        ON "Notification"("createdAt");
CREATE INDEX "ActivityLog_contactId_idx"         ON "ActivityLog"("contactId");
CREATE INDEX "ActivityLog_companyId_idx"         ON "ActivityLog"("companyId");
CREATE INDEX "ActivityLog_opportunityId_idx"     ON "ActivityLog"("opportunityId");
CREATE INDEX "ActivityLog_userId_idx"            ON "ActivityLog"("userId");
CREATE INDEX "ActivityLog_createdAt_idx"         ON "ActivityLog"("createdAt");
CREATE INDEX "AIConversation_userId_idx"         ON "AIConversation"("userId");
CREATE INDEX "AIConversation_createdAt_idx"      ON "AIConversation"("createdAt");
CREATE INDEX "AIMessage_conversationId_idx"      ON "AIMessage"("conversationId");
CREATE INDEX "AIMessage_createdAt_idx"           ON "AIMessage"("createdAt");
CREATE INDEX "MetricSnapshot_date_idx"           ON "MetricSnapshot"("date");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────
ALTER TABLE "CustomValue"      ADD CONSTRAINT "CustomValue_userId_fkey"            FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "ApiKey"           ADD CONSTRAINT "ApiKey_userId_fkey"                 FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "ApiLog"           ADD CONSTRAINT "ApiLog_apiKeyId_fkey"               FOREIGN KEY ("apiKeyId")          REFERENCES "ApiKey"("id")          ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint"  ADD CONSTRAINT "WebhookEndpoint_userId_fkey"        FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "WebhookLog"       ADD CONSTRAINT "WebhookLog_webhookEndpointId_fkey"  FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "Contact"          ADD CONSTRAINT "Contact_companyId_fkey"             FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId")   REFERENCES "CustomField"("id")     ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_contactId_fkey"    FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "Pipeline"         ADD CONSTRAINT "Pipeline_userId_fkey"               FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Stage"            ADD CONSTRAINT "Stage_pipelineId_fkey"              FOREIGN KEY ("pipelineId")        REFERENCES "Pipeline"("id")        ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "Opportunity"      ADD CONSTRAINT "Opportunity_contactId_fkey"         FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Opportunity"      ADD CONSTRAINT "Opportunity_companyId_fkey"         FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Opportunity"      ADD CONSTRAINT "Opportunity_stageId_fkey"           FOREIGN KEY ("stageId")           REFERENCES "Stage"("id")           ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Opportunity"      ADD CONSTRAINT "Opportunity_pipelineId_fkey"        FOREIGN KEY ("pipelineId")        REFERENCES "Pipeline"("id")        ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Opportunity"      ADD CONSTRAINT "Opportunity_assignedTo_fkey"        FOREIGN KEY ("assignedTo")        REFERENCES "User"("id")            ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "CalendarConfig"   ADD CONSTRAINT "CalendarConfig_userId_fkey"         FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"    ADD CONSTRAINT "CalendarEvent_calendarConfigId_fkey" FOREIGN KEY ("calendarConfigId") REFERENCES "CalendarConfig"("id")  ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"    ADD CONSTRAINT "CalendarEvent_contactId_fkey"       FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"    ADD CONSTRAINT "CalendarEvent_userId_fkey"          FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Task"             ADD CONSTRAINT "Task_contactId_fkey"                FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Task"             ADD CONSTRAINT "Task_companyId_fkey"                FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Task"             ADD CONSTRAINT "Task_assignedTo_fkey"               FOREIGN KEY ("assignedTo")        REFERENCES "User"("id")            ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Task"             ADD CONSTRAINT "Task_followUpTaskId_fkey"           FOREIGN KEY ("followUpTaskId")    REFERENCES "Task"("id")            ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Task"             ADD CONSTRAINT "Task_templateId_fkey"               FOREIGN KEY ("templateId")        REFERENCES "TaskTemplate"("id")    ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Message"          ADD CONSTRAINT "Message_contactId_fkey"             FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_contactId_fkey"    FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_userId_fkey"       FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Product"          ADD CONSTRAINT "Product_userId_fkey"                FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Order"            ADD CONSTRAINT "Order_contactId_fkey"               FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Order"            ADD CONSTRAINT "Order_companyId_fkey"               FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Order"            ADD CONSTRAINT "Order_productId_fkey"               FOREIGN KEY ("productId")         REFERENCES "Product"("id")         ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Subscription"     ADD CONSTRAINT "Subscription_contactId_fkey"        FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Subscription"     ADD CONSTRAINT "Subscription_companyId_fkey"        FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Subscription"     ADD CONSTRAINT "Subscription_productId_fkey"        FOREIGN KEY ("productId")         REFERENCES "Product"("id")         ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Invoice"          ADD CONSTRAINT "Invoice_orderId_fkey"               FOREIGN KEY ("orderId")           REFERENCES "Order"("id")           ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Invoice"          ADD CONSTRAINT "Invoice_contactId_fkey"             FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Coupon"           ADD CONSTRAINT "Coupon_productId_fkey"              FOREIGN KEY ("productId")         REFERENCES "Product"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Automation"       ADD CONSTRAINT "Automation_userId_fkey"             FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "AutomationLog"    ADD CONSTRAINT "AutomationLog_automationId_fkey"    FOREIGN KEY ("automationId")      REFERENCES "Automation"("id")      ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "AutomationLog"    ADD CONSTRAINT "AutomationLog_contactId_fkey"       FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "AutomationQueue"  ADD CONSTRAINT "AutomationQueue_automationId_fkey"  FOREIGN KEY ("automationId")      REFERENCES "Automation"("id")      ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "AutomationQueue"  ADD CONSTRAINT "AutomationQueue_contactId_fkey"     FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "FileAttachment"   ADD CONSTRAINT "FileAttachment_contactId_fkey"      FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "FileAttachment"   ADD CONSTRAINT "FileAttachment_companyId_fkey"      FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "FileAttachment"   ADD CONSTRAINT "FileAttachment_uploadedBy_fkey"     FOREIGN KEY ("uploadedBy")        REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Notification"     ADD CONSTRAINT "Notification_userId_fkey"           FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "ActivityLog"      ADD CONSTRAINT "ActivityLog_contactId_fkey"         FOREIGN KEY ("contactId")         REFERENCES "Contact"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "ActivityLog"      ADD CONSTRAINT "ActivityLog_companyId_fkey"         FOREIGN KEY ("companyId")         REFERENCES "Company"("id")         ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "ActivityLog"      ADD CONSTRAINT "ActivityLog_opportunityId_fkey"     FOREIGN KEY ("opportunityId")     REFERENCES "Opportunity"("id")     ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "ActivityLog"      ADD CONSTRAINT "ActivityLog_userId_fkey"            FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "AIConversation"   ADD CONSTRAINT "AIConversation_userId_fkey"         FOREIGN KEY ("userId")            REFERENCES "User"("id")            ON DELETE CASCADE   ON UPDATE CASCADE;
ALTER TABLE "AIMessage"        ADD CONSTRAINT "AIMessage_conversationId_fkey"      FOREIGN KEY ("conversationId")    REFERENCES "AIConversation"("id")  ON DELETE CASCADE   ON UPDATE CASCADE;
