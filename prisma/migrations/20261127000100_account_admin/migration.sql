CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE','PENDING','REJECTED','BLOCKED','ARCHIVED');
ALTER TABLE "users" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "fullName" TEXT, ADD COLUMN "email" TEXT, ADD COLUMN "createdAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_status_createdAt_idx" ON "users"("status","createdAt");
CREATE TABLE "Invitation" ("id" TEXT PRIMARY KEY, "digest" TEXT NOT NULL UNIQUE, "creatorId" TEXT NOT NULL REFERENCES "users"("id") ON UPDATE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3));
CREATE INDEX "Invitation_createdAt_idx" ON "Invitation"("createdAt");
