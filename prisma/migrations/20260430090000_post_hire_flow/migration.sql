-- Add WITHDRAWN to ApplicationStatus enum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

-- Add vacancies count to Job
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "vacancies" INTEGER NOT NULL DEFAULT 1;
