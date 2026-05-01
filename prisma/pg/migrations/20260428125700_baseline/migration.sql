-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "themePreference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instituteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "branchId" TEXT,
    "instituteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentId" TEXT,
    "inviterUserId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "emergencyContact" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "batchId" TEXT,
    "instituteId" TEXT,
    "parentUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "instituteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startTime" TEXT,
    "endTime" TEXT,
    "coachId" TEXT,
    "branchId" TEXT,
    "instituteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProgressEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instituteId" TEXT,
    "sessionDate" TEXT NOT NULL,
    "technicalScore" INTEGER,
    "tacticalScore" INTEGER,
    "physicalScore" INTEGER,
    "mentalScore" INTEGER,
    "disciplineScore" INTEGER,
    "remarks" TEXT,
    "targetTierLabel" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressAssessment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
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
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "ProgressAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressAssessmentExercise" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "exerciseName" TEXT NOT NULL,
    "expectedPerformance" TEXT,
    "observedPerformance" TEXT,
    "note" TEXT,
    "targetReps" INTEGER,
    "targetSets" INTEGER,
    "completedReps" INTEGER,
    "completedSets" INTEGER,

    CONSTRAINT "ProgressAssessmentExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReview" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchAssistant" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BatchAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "instituteId" TEXT,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lastEditedByUserId" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "instituteId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "Branch_instituteId_idx" ON "Branch"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE INDEX "User_instituteId_idx" ON "User"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_instituteId_email_usedAt_idx" ON "Invite"("instituteId", "email", "usedAt");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Invite_studentId_usedAt_idx" ON "Invite"("studentId", "usedAt");

-- CreateIndex
CREATE INDEX "Student_fullName_idx" ON "Student"("fullName");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_batchId_idx" ON "Student"("batchId");

-- CreateIndex
CREATE INDEX "Student_instituteId_idx" ON "Student"("instituteId");

-- CreateIndex
CREATE INDEX "Student_parentUserId_idx" ON "Student"("parentUserId");

-- CreateIndex
CREATE INDEX "Coach_status_idx" ON "Coach"("status");

-- CreateIndex
CREATE INDEX "Coach_instituteId_idx" ON "Coach"("instituteId");

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status");

-- CreateIndex
CREATE INDEX "Batch_coachId_idx" ON "Batch"("coachId");

-- CreateIndex
CREATE INDEX "Batch_branchId_idx" ON "Batch"("branchId");

-- CreateIndex
CREATE INDEX "Batch_instituteId_idx" ON "Batch"("instituteId");

-- CreateIndex
CREATE INDEX "StudentProgressEntry_studentId_sessionDate_idx" ON "StudentProgressEntry"("studentId", "sessionDate");

-- CreateIndex
CREATE INDEX "StudentProgressEntry_instituteId_idx" ON "StudentProgressEntry"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProgressEntry_studentId_sessionDate_key" ON "StudentProgressEntry"("studentId", "sessionDate");

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

-- CreateIndex
CREATE INDEX "ProgressAssessmentExercise_assessmentId_sortOrder_idx" ON "ProgressAssessmentExercise"("assessmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "StudentReview_studentId_createdAt_idx" ON "StudentReview"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentReview_instituteId_createdAt_idx" ON "StudentReview"("instituteId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentReview_authorUserId_createdAt_idx" ON "StudentReview"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "BatchAssistant_userId_idx" ON "BatchAssistant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchAssistant_batchId_userId_key" ON "BatchAssistant"("batchId", "userId");

-- CreateIndex
CREATE INDEX "Attendance_batchId_date_idx" ON "Attendance"("batchId", "date");

-- CreateIndex
CREATE INDEX "Attendance_studentId_date_idx" ON "Attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "Attendance_instituteId_idx" ON "Attendance"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_batchId_date_key" ON "Attendance"("studentId", "batchId", "date");

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

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressEntry" ADD CONSTRAINT "StudentProgressEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressEntry" ADD CONSTRAINT "StudentProgressEntry_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessment" ADD CONSTRAINT "ProgressAssessment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessment" ADD CONSTRAINT "ProgressAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessment" ADD CONSTRAINT "ProgressAssessment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessment" ADD CONSTRAINT "ProgressAssessment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessment" ADD CONSTRAINT "ProgressAssessment_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessment" ADD CONSTRAINT "ProgressAssessment_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressAssessmentExercise" ADD CONSTRAINT "ProgressAssessmentExercise_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ProgressAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReview" ADD CONSTRAINT "StudentReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReview" ADD CONSTRAINT "StudentReview_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReview" ADD CONSTRAINT "StudentReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchAssistant" ADD CONSTRAINT "BatchAssistant_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchAssistant" ADD CONSTRAINT "BatchAssistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

