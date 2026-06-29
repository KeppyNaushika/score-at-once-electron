-- 旧・死にフラグ statistics を削除（値は 20260629120000 で teacherStat へ移行済み）
ALTER TABLE "ExamClass" DROP COLUMN "statistics";
