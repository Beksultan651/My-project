CREATE TABLE "LearningDemoProfile" (
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningDemoProfile_pkey" PRIMARY KEY ("adminId"),
    CONSTRAINT "LearningDemoProfile_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LearningTask" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "body" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningTask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LearningTask_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearningTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LearningTask_adminId_createdAt_idx" ON "LearningTask"("adminId", "createdAt");
CREATE INDEX "LearningTask_assigneeId_createdAt_idx" ON "LearningTask"("assigneeId", "createdAt");
