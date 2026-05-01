/*
  Warnings:

  - You are about to drop the column `acceptedByUserId` on the `Invite` table. All the data in the column will be lost.
  - Added the required column `invitedUserId` to the `Invite` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "branchId" TEXT,
    "inviterUserId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invite" ("branchId", "createdAt", "email", "expiresAt", "fullName", "id", "instituteId", "inviterUserId", "invitedUserId", "role", "tokenHash", "usedAt")
SELECT "branchId", "createdAt", "email", "expiresAt", "fullName", "id", "instituteId", "inviterUserId", "acceptedByUserId", "role", "tokenHash", "usedAt"
FROM "Invite";
DROP TABLE "Invite";
ALTER TABLE "new_Invite" RENAME TO "Invite";
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE INDEX "Invite_instituteId_email_usedAt_idx" ON "Invite"("instituteId", "email", "usedAt");
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
