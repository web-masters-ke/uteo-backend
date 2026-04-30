-- Support tickets — persisted help/raise-a-ticket flow
DO $$ BEGIN
  CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "priority"    "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
  "status"      "SupportStatus"   NOT NULL DEFAULT 'OPEN',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "closedAt"    TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "SupportTicket_userId_createdAt_idx" ON "SupportTicket" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket" ("status");

DO $$ BEGIN
  ALTER TABLE "SupportTicket"
    ADD CONSTRAINT "SupportTicket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SupportTicketReply" (
  "id"        TEXT PRIMARY KEY,
  "ticketId"  TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "isStaff"   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportTicketReply_ticketId_createdAt_idx" ON "SupportTicketReply" ("ticketId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SupportTicketReply"
    ADD CONSTRAINT "SupportTicketReply_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicketReply"
    ADD CONSTRAINT "SupportTicketReply_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
