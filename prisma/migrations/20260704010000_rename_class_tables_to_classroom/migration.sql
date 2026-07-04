-- 学級(Classroom)関連テーブルの物理名を @@map 旧「Class」名からモデル名へ統一。
-- モデル/カラム名は既に Classroom 系（20260702010000 で列 classId→classroomId 済み）だが、
-- 物理テーブル名だけ classes / *Class の旧名が @@map で残っていた。これを解消する。
-- 併せて ExamClassroom.teacherStat を teacherStatistics へリネーム（略語解消）。
--
-- 【重要】RENAME TO が他テーブルの inbound FK 参照（子テーブルの REFERENCES "classes" 等）を
-- 書き換えるのは foreign_keys=ON のときのみ。migrationDeployer は FK 既定 OFF で適用するため、
-- OFF のままだと子テーブル（StudentClassroomMembership / ExamClassroom / GradeClassroom /
-- CourseworkClassroom）が消えた旧名を参照する dangling FK になる。よってリネーム前に明示的に
-- ON にする（bridgeMigrations.ts:750-751 と同方針）。deployer はトランザクション非使用のため
-- PRAGMA が有効。末尾で deployer 既定の OFF に戻す。
-- インデックス名は RENAME TO で旧プレフィックスのまま残るため、DROP/CREATE で新名に揃える。

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. テーブル物理名のリネーム
-- ============================================================================
ALTER TABLE "classes" RENAME TO "Classroom";
ALTER TABLE "StudentClassMembership" RENAME TO "StudentClassroomMembership";
ALTER TABLE "ExamClass" RENAME TO "ExamClassroom";
ALTER TABLE "GradeClass" RENAME TO "GradeClassroom";
ALTER TABLE "CourseworkClass" RENAME TO "CourseworkClassroom";

-- ============================================================================
-- 2. インデックス名を新テーブル名プレフィックスへ揃える
--    （RENAME TO はインデックスを引き継ぐが名称は旧プレフィックスのまま残るため）
-- ============================================================================

-- Classroom（旧 classes）: name UNIQUE
DROP INDEX IF EXISTS "classes_name_key";
CREATE UNIQUE INDEX "Classroom_name_key" ON "Classroom"("name");

-- StudentClassroomMembership（旧 StudentClassMembership）
DROP INDEX IF EXISTS "StudentClassMembership_studentId_idx";
DROP INDEX IF EXISTS "StudentClassMembership_classroomId_idx";
DROP INDEX IF EXISTS "StudentClassMembership_classroomId_attendanceNumber_idx";
DROP INDEX IF EXISTS "StudentClassMembership_startDate_endDate_idx";
CREATE INDEX "StudentClassroomMembership_studentId_idx" ON "StudentClassroomMembership"("studentId");
CREATE INDEX "StudentClassroomMembership_classroomId_idx" ON "StudentClassroomMembership"("classroomId");
CREATE INDEX "StudentClassroomMembership_classroomId_attendanceNumber_idx" ON "StudentClassroomMembership"("classroomId", "attendanceNumber");
CREATE INDEX "StudentClassroomMembership_startDate_endDate_idx" ON "StudentClassroomMembership"("startDate", "endDate");

-- ExamClassroom（旧 ExamClass）
DROP INDEX IF EXISTS "ExamClass_examId_classroomId_key";
DROP INDEX IF EXISTS "ExamClass_examId_idx";
DROP INDEX IF EXISTS "ExamClass_classroomId_idx";
CREATE UNIQUE INDEX "ExamClassroom_examId_classroomId_key" ON "ExamClassroom"("examId", "classroomId");
CREATE INDEX "ExamClassroom_examId_idx" ON "ExamClassroom"("examId");
CREATE INDEX "ExamClassroom_classroomId_idx" ON "ExamClassroom"("classroomId");

-- GradeClassroom（旧 GradeClass）
DROP INDEX IF EXISTS "GradeClass_gradeId_classroomId_key";
DROP INDEX IF EXISTS "GradeClass_gradeId_idx";
DROP INDEX IF EXISTS "GradeClass_classroomId_idx";
CREATE UNIQUE INDEX "GradeClassroom_gradeId_classroomId_key" ON "GradeClassroom"("gradeId", "classroomId");
CREATE INDEX "GradeClassroom_gradeId_idx" ON "GradeClassroom"("gradeId");
CREATE INDEX "GradeClassroom_classroomId_idx" ON "GradeClassroom"("classroomId");

-- CourseworkClassroom（旧 CourseworkClass）
DROP INDEX IF EXISTS "CourseworkClass_courseworkId_classroomId_key";
DROP INDEX IF EXISTS "CourseworkClass_courseworkId_idx";
DROP INDEX IF EXISTS "CourseworkClass_classroomId_idx";
CREATE UNIQUE INDEX "CourseworkClassroom_courseworkId_classroomId_key" ON "CourseworkClassroom"("courseworkId", "classroomId");
CREATE INDEX "CourseworkClassroom_courseworkId_idx" ON "CourseworkClassroom"("courseworkId");
CREATE INDEX "CourseworkClassroom_classroomId_idx" ON "CourseworkClassroom"("classroomId");

-- ============================================================================
-- 3. ExamClassroom.teacherStat → teacherStatistics（略語解消）
-- ============================================================================
ALTER TABLE "ExamClassroom" RENAME COLUMN "teacherStat" TO "teacherStatistics";

-- ============================================================================
-- 4. tombstone の防御的整合（DeletedRecord.tableName は物理名を直接 DELETE に展開する）。
--    現状 Class 系の tombstone は記録されないが（DrawingAnnotation のみ）、
--    他バージョン由来で旧名が存在した場合に備え deletedAt を温存したまま新名へ書き換える。
-- ============================================================================
UPDATE "DeletedRecord" SET "tableName" = 'Classroom' WHERE "tableName" = 'classes';
UPDATE "DeletedRecord" SET "tableName" = 'StudentClassroomMembership' WHERE "tableName" = 'StudentClassMembership';
UPDATE "DeletedRecord" SET "tableName" = 'ExamClassroom' WHERE "tableName" = 'ExamClass';
UPDATE "DeletedRecord" SET "tableName" = 'GradeClassroom' WHERE "tableName" = 'GradeClass';
UPDATE "DeletedRecord" SET "tableName" = 'CourseworkClassroom' WHERE "tableName" = 'CourseworkClass';

-- ============================================================================
-- 5. FK enforcement を deployer 既定（OFF）へ戻す
-- ============================================================================
PRAGMA foreign_keys = OFF;
