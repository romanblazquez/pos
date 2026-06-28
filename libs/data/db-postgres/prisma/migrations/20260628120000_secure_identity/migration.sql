-- Central first-party identity, Google account linkage, rotating sessions and audit log.
CREATE TABLE "AuthPrincipal" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "displayName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthPrincipal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FederatedIdentity" (
  "id" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "providerEmail" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "hostedDomain" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FederatedIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "replacedBySessionId" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthChallenge" (
  "id" TEXT NOT NULL,
  "app" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthTransaction" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "codeVerifier" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAdminMembership" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "principalId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'platform_admin',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAdminMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorPrincipalId" TEXT,
  "sessionId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'success',
  "correlationId" TEXT,
  "ipAddress" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Seller" ADD COLUMN "authPrincipalId" TEXT;
ALTER TABLE "MktCustomer" ADD COLUMN "authPrincipalId" TEXT;

CREATE UNIQUE INDEX "AuthPrincipal_normalizedEmail_key" ON "AuthPrincipal"("normalizedEmail");
CREATE INDEX "AuthPrincipal_status_idx" ON "AuthPrincipal"("status");
CREATE UNIQUE INDEX "FederatedIdentity_provider_providerSubject_key" ON "FederatedIdentity"("provider", "providerSubject");
CREATE INDEX "FederatedIdentity_principalId_idx" ON "FederatedIdentity"("principalId");
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX "AuthSession_principalId_revokedAt_idx" ON "AuthSession"("principalId", "revokedAt");
CREATE INDEX "AuthSession_familyId_idx" ON "AuthSession"("familyId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE UNIQUE INDEX "AuthChallenge_stateHash_key" ON "AuthChallenge"("stateHash");
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");
CREATE UNIQUE INDEX "OAuthTransaction_stateHash_key" ON "OAuthTransaction"("stateHash");
CREATE INDEX "OAuthTransaction_provider_ownerId_idx" ON "OAuthTransaction"("provider", "ownerId");
CREATE INDEX "OAuthTransaction_expiresAt_idx" ON "OAuthTransaction"("expiresAt");
CREATE UNIQUE INDEX "PlatformAdminMembership_email_key" ON "PlatformAdminMembership"("email");
CREATE UNIQUE INDEX "PlatformAdminMembership_principalId_key" ON "PlatformAdminMembership"("principalId");
CREATE INDEX "PlatformAdminMembership_status_idx" ON "PlatformAdminMembership"("status");
CREATE INDEX "AuditEvent_actorPrincipalId_createdAt_idx" ON "AuditEvent"("actorPrincipalId", "createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");
CREATE UNIQUE INDEX "Seller_authPrincipalId_key" ON "Seller"("authPrincipalId");
CREATE UNIQUE INDEX "MktCustomer_authPrincipalId_key" ON "MktCustomer"("authPrincipalId");

ALTER TABLE "FederatedIdentity" ADD CONSTRAINT "FederatedIdentity_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "AuthPrincipal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "AuthPrincipal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminMembership" ADD CONSTRAINT "PlatformAdminMembership_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "AuthPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorPrincipalId_fkey" FOREIGN KEY ("actorPrincipalId") REFERENCES "AuthPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_authPrincipalId_fkey" FOREIGN KEY ("authPrincipalId") REFERENCES "AuthPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MktCustomer" ADD CONSTRAINT "MktCustomer_authPrincipalId_fkey" FOREIGN KEY ("authPrincipalId") REFERENCES "AuthPrincipal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- First production administrator. Google login still has to verify this exact address.
INSERT INTO "PlatformAdminMembership" ("id", "email", "role", "status", "createdAt", "updatedAt")
VALUES ('bootstrap-admin-matias', 'matiasblazquez@gmail.com', 'platform_admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;
