-- CreateTable
CREATE TABLE "StudentReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentReview_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentReview_studentId_createdAt_idx" ON "StudentReview"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentReview_instituteId_createdAt_idx" ON "StudentReview"("instituteId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentReview_authorUserId_createdAt_idx" ON "StudentReview"("authorUserId", "createdAt");
