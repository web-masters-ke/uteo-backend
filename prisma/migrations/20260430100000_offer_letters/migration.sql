-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OfferLetter" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "termsHtml" TEXT,
  "salaryAmount" DOUBLE PRECISION,
  "salaryCurrency" TEXT NOT NULL DEFAULT 'KES',
  "salaryPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
  "startDate" TIMESTAMP(3),
  "benefits" TEXT,
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "expiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "signatureName" TEXT,
  "signatureDataUrl" TEXT,
  "signatureIpAddress" TEXT,
  "signatureUserAgent" TEXT,
  "declineReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfferLetter_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "OfferLetter_applicationId_key" ON "OfferLetter"("applicationId");
CREATE INDEX IF NOT EXISTS "OfferLetter_candidateId_status_idx" ON "OfferLetter"("candidateId", "status");
CREATE INDEX IF NOT EXISTS "OfferLetter_companyId_status_idx" ON "OfferLetter"("companyId", "status");
CREATE INDEX IF NOT EXISTS "OfferLetter_jobId_idx" ON "OfferLetter"("jobId");

-- Foreign keys
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE;
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE;
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;
