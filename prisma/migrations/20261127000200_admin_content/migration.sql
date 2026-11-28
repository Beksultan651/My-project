CREATE TABLE "AdminContent" ("id" TEXT PRIMARY KEY,"kind" TEXT NOT NULL,"title" TEXT NOT NULL,"body" TEXT NOT NULL,"parentId" TEXT REFERENCES "AdminContent"("id") ON DELETE SET NULL ON UPDATE CASCADE,"archived" BOOLEAN NOT NULL DEFAULT false,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AdminContent_kind_archived_idx" ON "AdminContent"("kind","archived");
