-- CreateTable
CREATE TABLE "ProgressAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "assessmentDate" DATETIME NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'ADHOC',
    "periodKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "strengthScore" INTEGER,
    "flexibilityScore" INTEGER,
    "techniqueScore" INTEGER,
    "disciplineScore" INTEGER,
    "overallScore" INTEGER,
    "coachNotes" TEXT,
    "assessmentIndicator" TEXT,
    "authorUserId" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "submittedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    CONSTRAINT "ProgressAssessment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressAssessment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressAssessment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProgressAssessment_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProgressAssessment_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProgressAssessment_instituteId_status_idx" ON "ProgressAssessment"("instituteId", "status");

-- CreateIndex
CREATE INDEX "ProgressAssessment_instituteId_batchId_status_idx" ON "ProgressAssessment"("instituteId", "batchId", "status");

-- CreateIndex
CREATE INDEX "ProgressAssessment_studentId_assessmentDate_idx" ON "ProgressAssessment"("studentId", "assessmentDate");

-- CreateIndex
CREATE INDEX "ProgressAssessment_instituteId_assessmentDate_idx" ON "ProgressAssessment"("instituteId", "assessmentDate");

-- CreateIndex
CREATE INDEX "ProgressAssessment_reviewedByUserId_idx" ON "ProgressAssessment"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "ProgressAssessment_authorUserId_idx" ON "ProgressAssessment"("authorUserId");
