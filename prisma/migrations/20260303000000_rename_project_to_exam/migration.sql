-- =============================================================
-- Migration: Project → Exam, GradeProject → Grade rename
-- =============================================================
-- This migration renames tables, columns, and indexes to align
-- with the new naming convention (Project → Exam, GradeProject → Grade).
-- Data is fully preserved through ALTER TABLE RENAME operations.
--
-- IMPORTANT: PRAGMA foreign_keys = ON must be set so that
-- ALTER TABLE RENAME automatically updates FK references
-- in other tables' schema definitions.
-- =============================================================

PRAGMA foreign_keys = ON;

-- =============================================================
-- Step 1: Rename tables
-- =============================================================

ALTER TABLE "Project" RENAME TO "Exam";
ALTER TABLE "ProjectStudent" RENAME TO "ExamStudent";
ALTER TABLE "ProjectPage" RENAME TO "ExamPage";
ALTER TABLE "UserProject" RENAME TO "UserExam";
ALTER TABLE "ProjectSubtotalGroup" RENAME TO "ExamSubtotalGroup";
ALTER TABLE "ProjectClass" RENAME TO "ExamClass";
ALTER TABLE "ProjectMarkingFormat" RENAME TO "ExamMarkingFormat";
ALTER TABLE "ProjectExportSettings" RENAME TO "ExamExportSettings";
ALTER TABLE "GradeProject" RENAME TO "Grade";
ALTER TABLE "GradeProjectClass" RENAME TO "GradeClass";
ALTER TABLE "GradeProjectStudent" RENAME TO "GradeStudent";
ALTER TABLE "GradeProjectExportSettings" RENAME TO "GradeExportSettings";

-- =============================================================
-- Step 2: Rename columns (projectId → examId, etc.)
-- SQLite 3.25+ automatically updates index column references
-- =============================================================

-- Exam domain: projectId → examId
ALTER TABLE "ExamStudent" RENAME COLUMN "projectId" TO "examId";
ALTER TABLE "ExamPage" RENAME COLUMN "projectId" TO "examId";
ALTER TABLE "UserExam" RENAME COLUMN "projectId" TO "examId";
ALTER TABLE "ExamSubtotalGroup" RENAME COLUMN "projectId" TO "examId";
ALTER TABLE "ExamClass" RENAME COLUMN "projectId" TO "examId";
ALTER TABLE "ExamMarkingFormat" RENAME COLUMN "projectId" TO "examId";
ALTER TABLE "ExamExportSettings" RENAME COLUMN "projectId" TO "examId";

-- Exam domain: projectPageId → examPageId
ALTER TABLE "MasterImage" RENAME COLUMN "projectPageId" TO "examPageId";
ALTER TABLE "StudentAnswerImage" RENAME COLUMN "projectPageId" TO "examPageId";
ALTER TABLE "CropRegion" RENAME COLUMN "projectPageId" TO "examPageId";

-- Grade domain: gradeProjectId → gradeId
ALTER TABLE "GradeItem" RENAME COLUMN "gradeProjectId" TO "gradeId";
ALTER TABLE "GradeClass" RENAME COLUMN "gradeProjectId" TO "gradeId";
ALTER TABLE "GradeStudent" RENAME COLUMN "gradeProjectId" TO "gradeId";
ALTER TABLE "GradeItemExclusion" RENAME COLUMN "gradeProjectId" TO "gradeId";
ALTER TABLE "GradeBoundarySet" RENAME COLUMN "gradeProjectId" TO "gradeId";
ALTER TABLE "GradeOverride" RENAME COLUMN "gradeProjectId" TO "gradeId";
ALTER TABLE "GradeExportSettings" RENAME COLUMN "gradeProjectId" TO "gradeId";

-- GradeDataSource: examProjectId → examId
ALTER TABLE "GradeDataSource" RENAME COLUMN "examProjectId" TO "examId";

-- =============================================================
-- Step 3: Recreate indexes with new names
-- Drop old-named indexes and create new ones.
-- Column references were already updated by RENAME COLUMN.
-- =============================================================

-- --- ExamStudent (was ProjectStudent) ---
DROP INDEX IF EXISTS "ProjectStudent_projectId_studentId_key";
CREATE UNIQUE INDEX "ExamStudent_examId_studentId_key" ON "ExamStudent"("examId", "studentId");

DROP INDEX IF EXISTS "ProjectStudent_projectId_idx";
CREATE INDEX "ExamStudent_examId_idx" ON "ExamStudent"("examId");

DROP INDEX IF EXISTS "ProjectStudent_studentId_idx";
CREATE INDEX "ExamStudent_studentId_idx" ON "ExamStudent"("studentId");

DROP INDEX IF EXISTS "ProjectStudent_projectId_customOrder_idx";
CREATE INDEX "ExamStudent_examId_customOrder_idx" ON "ExamStudent"("examId", "customOrder");

-- --- StudentAnswerImage (column rename only) ---
DROP INDEX IF EXISTS "StudentAnswerImage_projectPageId_studentId_key";
CREATE UNIQUE INDEX "StudentAnswerImage_examPageId_studentId_key" ON "StudentAnswerImage"("examPageId", "studentId");

DROP INDEX IF EXISTS "StudentAnswerImage_projectPageId_idx";
CREATE INDEX "StudentAnswerImage_examPageId_idx" ON "StudentAnswerImage"("examPageId");

-- StudentAnswerImage_studentId_idx: no rename needed (column unchanged)

-- --- UserExam (was UserProject) ---
DROP INDEX IF EXISTS "UserProject_userId_projectId_key";
CREATE UNIQUE INDEX "UserExam_userId_examId_key" ON "UserExam"("userId", "examId");

DROP INDEX IF EXISTS "UserProject_projectId_idx";
CREATE INDEX "UserExam_examId_idx" ON "UserExam"("examId");

-- --- ExamClass (was ProjectClass) ---
DROP INDEX IF EXISTS "ProjectClass_projectId_classId_key";
CREATE UNIQUE INDEX "ExamClass_examId_classId_key" ON "ExamClass"("examId", "classId");

DROP INDEX IF EXISTS "ProjectClass_projectId_idx";
CREATE INDEX "ExamClass_examId_idx" ON "ExamClass"("examId");

DROP INDEX IF EXISTS "ProjectClass_classId_idx";
CREATE INDEX "ExamClass_classId_idx" ON "ExamClass"("classId");

-- --- ExamMarkingFormat (was ProjectMarkingFormat) ---
DROP INDEX IF EXISTS "ProjectMarkingFormat_projectId_markType_key";
CREATE UNIQUE INDEX "ExamMarkingFormat_examId_markType_key" ON "ExamMarkingFormat"("examId", "markType");

DROP INDEX IF EXISTS "ProjectMarkingFormat_projectId_idx";
CREATE INDEX "ExamMarkingFormat_examId_idx" ON "ExamMarkingFormat"("examId");

-- --- ExamExportSettings (was ProjectExportSettings) ---
DROP INDEX IF EXISTS "ProjectExportSettings_projectId_key";
CREATE UNIQUE INDEX "ExamExportSettings_examId_key" ON "ExamExportSettings"("examId");

-- --- GradeItem ---
DROP INDEX IF EXISTS "GradeItem_gradeProjectId_idx";
CREATE INDEX "GradeItem_gradeId_idx" ON "GradeItem"("gradeId");

-- --- GradeClass (was GradeProjectClass) ---
DROP INDEX IF EXISTS "GradeProjectClass_gradeProjectId_classId_key";
CREATE UNIQUE INDEX "GradeClass_gradeId_classId_key" ON "GradeClass"("gradeId", "classId");

DROP INDEX IF EXISTS "GradeProjectClass_gradeProjectId_idx";
CREATE INDEX "GradeClass_gradeId_idx" ON "GradeClass"("gradeId");

DROP INDEX IF EXISTS "GradeProjectClass_classId_idx";
CREATE INDEX "GradeClass_classId_idx" ON "GradeClass"("classId");

-- --- GradeStudent (was GradeProjectStudent) ---
DROP INDEX IF EXISTS "GradeProjectStudent_gradeProjectId_studentId_key";
CREATE UNIQUE INDEX "GradeStudent_gradeId_studentId_key" ON "GradeStudent"("gradeId", "studentId");

DROP INDEX IF EXISTS "GradeProjectStudent_gradeProjectId_idx";
CREATE INDEX "GradeStudent_gradeId_idx" ON "GradeStudent"("gradeId");

DROP INDEX IF EXISTS "GradeProjectStudent_studentId_idx";
CREATE INDEX "GradeStudent_studentId_idx" ON "GradeStudent"("studentId");

DROP INDEX IF EXISTS "GradeProjectStudent_gradeProjectId_customOrder_idx";
CREATE INDEX "GradeStudent_gradeId_customOrder_idx" ON "GradeStudent"("gradeId", "customOrder");

-- --- GradeDataSource (column rename: examProjectId → examId) ---
DROP INDEX IF EXISTS "GradeDataSource_examProjectId_idx";
CREATE INDEX "GradeDataSource_examId_idx" ON "GradeDataSource"("examId");

-- GradeDataSource: gradeItemId, subtotalId, cropRegionId indexes unchanged

-- --- GradeItemExclusion ---
DROP INDEX IF EXISTS "GradeItemExclusion_gradeProjectId_studentId_gradeItemId_key";
CREATE UNIQUE INDEX "GradeItemExclusion_gradeId_studentId_gradeItemId_key" ON "GradeItemExclusion"("gradeId", "studentId", "gradeItemId");

DROP INDEX IF EXISTS "GradeItemExclusion_gradeProjectId_idx";
CREATE INDEX "GradeItemExclusion_gradeId_idx" ON "GradeItemExclusion"("gradeId");

-- GradeItemExclusion: studentId, gradeItemId indexes unchanged

-- --- GradeBoundarySet ---
DROP INDEX IF EXISTS "GradeBoundarySet_gradeProjectId_targetType_gradeItemId_key";
CREATE UNIQUE INDEX "GradeBoundarySet_gradeId_targetType_gradeItemId_key" ON "GradeBoundarySet"("gradeId", "targetType", "gradeItemId");

DROP INDEX IF EXISTS "GradeBoundarySet_gradeProjectId_idx";
CREATE INDEX "GradeBoundarySet_gradeId_idx" ON "GradeBoundarySet"("gradeId");

-- --- GradeOverride ---
DROP INDEX IF EXISTS "GradeOverride_gradeProjectId_studentId_targetType_gradeItemId_key";
CREATE UNIQUE INDEX "GradeOverride_gradeId_studentId_targetType_gradeItemId_key" ON "GradeOverride"("gradeId", "studentId", "targetType", "gradeItemId");

DROP INDEX IF EXISTS "GradeOverride_gradeProjectId_idx";
CREATE INDEX "GradeOverride_gradeId_idx" ON "GradeOverride"("gradeId");

-- GradeOverride: studentId, gradeItemId indexes unchanged

-- --- GradeExportSettings (was GradeProjectExportSettings) ---
DROP INDEX IF EXISTS "GradeProjectExportSettings_gradeProjectId_key";
CREATE UNIQUE INDEX "GradeExportSettings_gradeId_key" ON "GradeExportSettings"("gradeId");
