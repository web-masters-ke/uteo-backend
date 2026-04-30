-- Company social handles — used by the recruiter share flow to pre-fill
-- "@WebMasters is hiring..." with the right handle on LinkedIn/X/etc.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "linkedinHandle"  TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "linkedinPageUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "twitterHandle"   TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "facebookPageUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "instagramHandle" TEXT;
