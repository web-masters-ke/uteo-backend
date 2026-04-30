-- Add per-recruiter role for granular team permissions
DO $$ BEGIN
  CREATE TYPE "RecruiterRole" AS ENUM ('OWNER', 'ADMIN', 'HIRING_MANAGER', 'REVIEWER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Recruiter"
  ADD COLUMN IF NOT EXISTS "role" "RecruiterRole" NOT NULL DEFAULT 'HIRING_MANAGER';

-- Existing recruiters who own a company become OWNER
UPDATE "Recruiter" r
SET "role" = 'OWNER'
WHERE r."role" = 'HIRING_MANAGER'
  AND r."userId" IN (
    SELECT j."postedById"
    FROM "Job" j
    WHERE j."companyId" = r."companyId"
    LIMIT 1
  );
