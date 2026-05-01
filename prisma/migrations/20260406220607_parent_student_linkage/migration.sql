-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "emergencyContact" TEXT,
    "joiningDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "batchId" TEXT,
    "instituteId" TEXT,
    "parentUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("batchId", "createdAt", "dob", "emergencyContact", "fullName", "gender", "id", "instituteId", "joiningDate", "parentName", "parentPhone", "status", "updatedAt") SELECT "batchId", "createdAt", "dob", "emergencyContact", "fullName", "gender", "id", "instituteId", "joiningDate", "parentName", "parentPhone", "status", "updatedAt" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_fullName_idx" ON "Student"("fullName");
CREATE INDEX "Student_status_idx" ON "Student"("status");
CREATE INDEX "Student_batchId_idx" ON "Student"("batchId");
CREATE INDEX "Student_instituteId_idx" ON "Student"("instituteId");
CREATE INDEX "Student_parentUserId_idx" ON "Student"("parentUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
