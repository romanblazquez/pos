-- First-party visitor intelligence foundation.
-- Raw browser identifiers and advertising click IDs are HMACed by the API
-- before storage. Consent is append-only; identity links are auditable.

ALTER TABLE "analytics_event"
  ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo',
  ADD COLUMN "path" TEXT,
  ADD COLUMN "referrerHost" TEXT,
  ADD COLUMN "consentPublicId" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'browser';

CREATE UNIQUE INDEX "analytics_event_occurredAt_eventId_key"
  ON "analytics_event"("occurredAt", "eventId");
CREATE INDEX "analytics_event_tenantId_occurredAt_idx"
  ON "analytics_event"("tenantId", "occurredAt");

CREATE TABLE "analytics_visitor" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo',
  "publicIdHash" TEXT NOT NULL,
  "accountPrincipalId" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedAt" TIMESTAMP(3),
  "countryCode" CHAR(2),
  "locale" TEXT,
  "timezone" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "analytics_visitor_tenantId_publicIdHash_key" ON "analytics_visitor"("tenantId","publicIdHash");
CREATE INDEX "analytics_visitor_tenantId_accountPrincipalId_lastSeenAt_idx" ON "analytics_visitor"("tenantId","accountPrincipalId","lastSeenAt");
CREATE INDEX "analytics_visitor_tenantId_lastSeenAt_idx" ON "analytics_visitor"("tenantId","lastSeenAt");

CREATE TABLE "analytics_session" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo',
  "sessionIdHash" TEXT NOT NULL, "visitorId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3), "entryPath" TEXT, "exitPath" TEXT, "landingSource" TEXT,
  "eventCount" INTEGER NOT NULL DEFAULT 0, "pageViewCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "analytics_session_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "analytics_visitor"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "analytics_session_tenantId_sessionIdHash_key" ON "analytics_session"("tenantId","sessionIdHash");
CREATE INDEX "analytics_session_tenantId_startedAt_idx" ON "analytics_session"("tenantId","startedAt");
CREATE INDEX "analytics_session_visitorId_startedAt_idx" ON "analytics_session"("visitorId","startedAt");

CREATE TABLE "analytics_consent" (
  "id" TEXT PRIMARY KEY, "publicId" TEXT NOT NULL, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo',
  "visitorId" TEXT, "accountPrincipalId" TEXT, "policyVersion" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL, "regime" TEXT NOT NULL, "source" TEXT NOT NULL,
  "decisions" JSONB NOT NULL, "tcfStringHash" TEXT, "cmpName" TEXT, "cmpVersion" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "withdrawnAt" TIMESTAMP(3),
  CONSTRAINT "analytics_consent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "analytics_visitor"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "analytics_consent_publicId_key" ON "analytics_consent"("publicId");
CREATE INDEX "analytics_consent_tenantId_visitorId_recordedAt_idx" ON "analytics_consent"("tenantId","visitorId","recordedAt");
CREATE INDEX "analytics_consent_tenantId_accountPrincipalId_recordedAt_idx" ON "analytics_consent"("tenantId","accountPrincipalId","recordedAt");
CREATE INDEX "analytics_consent_tenantId_recordedAt_idx" ON "analytics_consent"("tenantId","recordedAt");

CREATE TABLE "analytics_identity_link" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "visitorId" TEXT NOT NULL,
  "accountPrincipalId" TEXT NOT NULL, "method" TEXT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
  CONSTRAINT "analytics_identity_link_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "analytics_visitor"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "analytics_identity_link_tenantId_visitorId_accountPrincipalId_key" ON "analytics_identity_link"("tenantId","visitorId","accountPrincipalId");
CREATE INDEX "analytics_identity_link_tenantId_accountPrincipalId_linkedAt_idx" ON "analytics_identity_link"("tenantId","accountPrincipalId","linkedAt");

CREATE TABLE "analytics_attribution" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "visitorId" TEXT NOT NULL,
  "sessionIdHash" TEXT, "touchType" TEXT NOT NULL, "provider" TEXT, "source" TEXT, "medium" TEXT,
  "campaign" TEXT, "term" TEXT, "content" TEXT, "clickIdHash" TEXT, "affiliateId" TEXT,
  "landingPath" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_attribution_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "analytics_visitor"("id") ON DELETE CASCADE
);
CREATE INDEX "analytics_attribution_tenantId_visitorId_occurredAt_idx" ON "analytics_attribution"("tenantId","visitorId","occurredAt");
CREATE INDEX "analytics_attribution_tenantId_campaign_occurredAt_idx" ON "analytics_attribution"("tenantId","campaign","occurredAt");

CREATE TABLE "analytics_preference" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "visitorId" TEXT NOT NULL,
  "key" TEXT NOT NULL, "value" JSONB NOT NULL, "explicit" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL, "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_preference_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "analytics_visitor"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "analytics_preference_tenantId_visitorId_key_key" ON "analytics_preference"("tenantId","visitorId","key");
CREATE INDEX "analytics_preference_tenantId_key_updatedAt_idx" ON "analytics_preference"("tenantId","key","updatedAt");

CREATE TABLE "analytics_experiment_assignment" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "visitorId" TEXT NOT NULL,
  "experimentKey" TEXT NOT NULL, "variant" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3),
  CONSTRAINT "analytics_experiment_assignment_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "analytics_visitor"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "analytics_experiment_assignment_tenantId_visitorId_experimentKey_key" ON "analytics_experiment_assignment"("tenantId","visitorId","experimentKey");
CREATE INDEX "analytics_experiment_assignment_tenantId_experimentKey_variant_idx" ON "analytics_experiment_assignment"("tenantId","experimentKey","variant");

CREATE TABLE "analytics_daily_aggregate" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "date" DATE NOT NULL,
  "dimension" TEXT NOT NULL, "dimensionKey" TEXT NOT NULL, "metrics" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "analytics_daily_aggregate_tenantId_date_dimension_dimensionKey_key" ON "analytics_daily_aggregate"("tenantId","date","dimension","dimensionKey");
CREATE INDEX "analytics_daily_aggregate_tenantId_dimension_date_idx" ON "analytics_daily_aggregate"("tenantId","dimension","date");

CREATE TABLE "analytics_privacy_request" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "accountPrincipalId" TEXT,
  "visitorHash" TEXT, "requestType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  "result" JSONB, "errorCode" TEXT
);
CREATE INDEX "analytics_privacy_request_tenantId_status_requestedAt_idx" ON "analytics_privacy_request"("tenantId","status","requestedAt");
CREATE INDEX "analytics_privacy_request_tenantId_accountPrincipalId_requestedAt_idx" ON "analytics_privacy_request"("tenantId","accountPrincipalId","requestedAt");

CREATE TABLE "analytics_saved_report" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'tenant-demo', "ownerPrincipalId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "reportType" TEXT NOT NULL, "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "analytics_saved_report_tenantId_ownerPrincipalId_updatedAt_idx" ON "analytics_saved_report"("tenantId","ownerPrincipalId","updatedAt");
