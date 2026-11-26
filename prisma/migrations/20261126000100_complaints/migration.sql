ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "complaints" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE, "message" TEXT NOT NULL, "reviewed" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "complaints_userId_createdAt_idx" ON "complaints"("userId","createdAt");
