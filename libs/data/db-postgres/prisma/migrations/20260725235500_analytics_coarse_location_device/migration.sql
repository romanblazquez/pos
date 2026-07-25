-- Privacy-preserving request context. Raw IP addresses and full user-agent
-- strings are deliberately not retained.
ALTER TABLE "analytics_visitor"
  ADD COLUMN "regionCode" TEXT;

ALTER TABLE "analytics_session"
  ADD COLUMN "deviceClass" TEXT,
  ADD COLUMN "browserFamily" TEXT,
  ADD COLUMN "osFamily" TEXT;
