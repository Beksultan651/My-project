-- CreateTable
CREATE TABLE "Supervision" (
    "studentId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supervision_pkey" PRIMARY KEY ("studentId","adminId")
);

-- CreateTable
CREATE TABLE "VirtualGrant" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "VirtualGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "advice" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEvent" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "student" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supervision_adminId_active_idx" ON "Supervision"("adminId", "active");

-- CreateIndex
CREATE INDEX "VirtualGrant_studentId_date_idx" ON "VirtualGrant"("studentId", "date");

-- CreateIndex
CREATE INDEX "CoachMessage_studentId_adminId_createdAt_idx" ON "CoachMessage"("studentId", "adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminEvent_actor_createdAt_idx" ON "AdminEvent"("actor", "createdAt");

-- AddForeignKey
ALTER TABLE "Supervision" ADD CONSTRAINT "Supervision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supervision" ADD CONSTRAINT "Supervision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualGrant" ADD CONSTRAINT "VirtualGrant_studentId_adminId_fkey" FOREIGN KEY ("studentId", "adminId") REFERENCES "Supervision"("studentId", "adminId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_studentId_adminId_fkey" FOREIGN KEY ("studentId", "adminId") REFERENCES "Supervision"("studentId", "adminId") ON DELETE RESTRICT ON UPDATE CASCADE;
