-- CreateTable
CREATE TABLE "ProgressAssessmentExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "exerciseName" TEXT NOT NULL,
    "expectedPerformance" TEXT,
    "observedPerformance" TEXT,
    "note" TEXT,
    CONSTRAINT "ProgressAssessmentExercise_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ProgressAssessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProgressAssessmentExercise_assessmentId_sortOrder_idx" ON "ProgressAssessmentExercise"("assessmentId", "sortOrder");
