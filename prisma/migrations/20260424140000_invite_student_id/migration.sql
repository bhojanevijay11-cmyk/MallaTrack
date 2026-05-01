-- AlterTable: parent invites reference Student; staff invites use NULL.
ALTER TABLE "Invite" ADD COLUMN "studentId" TEXT;

-- CreateIndex
CREATE INDEX "Invite_studentId_usedAt_idx" ON "Invite"("studentId", "usedAt");
