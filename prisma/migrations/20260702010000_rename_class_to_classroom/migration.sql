-- 学級(Classroom)関連テーブルの外部キー列 classId を classroomId へリネーム。
-- モデル Class → Classroom へのリネームに合わせた命名統一（テーブル名は @@map で classes 等のまま据え置き）。
-- SQLite 3.25+ の RENAME COLUMN は FK 制約とインデックスの内部列参照を自動更新するが、
-- インデックス名は旧名のまま残るため、DROP/CREATE で名称も classroomId 系へ揃える。

-- StudentClassMembership
ALTER TABLE "StudentClassMembership" RENAME COLUMN "classId" TO "classroomId";
DROP INDEX "StudentClassMembership_classId_idx";
DROP INDEX "StudentClassMembership_classId_attendanceNumber_idx";
CREATE INDEX "StudentClassMembership_classroomId_idx" ON "StudentClassMembership"("classroomId");
CREATE INDEX "StudentClassMembership_classroomId_attendanceNumber_idx" ON "StudentClassMembership"("classroomId", "attendanceNumber");

-- ExamClass
ALTER TABLE "ExamClass" RENAME COLUMN "classId" TO "classroomId";
DROP INDEX "ExamClass_classId_idx";
DROP INDEX "ExamClass_examId_classId_key";
CREATE INDEX "ExamClass_classroomId_idx" ON "ExamClass"("classroomId");
CREATE UNIQUE INDEX "ExamClass_examId_classroomId_key" ON "ExamClass"("examId", "classroomId");

-- GradeClass
ALTER TABLE "GradeClass" RENAME COLUMN "classId" TO "classroomId";
DROP INDEX "GradeClass_classId_idx";
DROP INDEX "GradeClass_gradeId_classId_key";
CREATE INDEX "GradeClass_classroomId_idx" ON "GradeClass"("classroomId");
CREATE UNIQUE INDEX "GradeClass_gradeId_classroomId_key" ON "GradeClass"("gradeId", "classroomId");

-- CourseworkClass
ALTER TABLE "CourseworkClass" RENAME COLUMN "classId" TO "classroomId";
DROP INDEX "CourseworkClass_classId_idx";
DROP INDEX "CourseworkClass_courseworkId_classId_key";
CREATE INDEX "CourseworkClass_classroomId_idx" ON "CourseworkClass"("classroomId");
CREATE UNIQUE INDEX "CourseworkClass_courseworkId_classroomId_key" ON "CourseworkClass"("courseworkId", "classroomId");
