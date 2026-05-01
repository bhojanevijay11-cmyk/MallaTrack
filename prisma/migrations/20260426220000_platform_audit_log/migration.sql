-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "instituteId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetType_idx" ON "PlatformAuditLog"("targetType");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetId_idx" ON "PlatformAuditLog"("targetId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_instituteId_idx" ON "PlatformAuditLog"("instituteId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
