-- ExamClass: 教員集計（teacherStat）・生徒表示（studentReport）フラグを追加
ALTER TABLE "ExamClass" ADD COLUMN "teacherStat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamClass" ADD COLUMN "studentReport" BOOLEAN NOT NULL DEFAULT false;

-- ExamSubtotalGroup: 小計テーブル・箱ひげ図の選択フラグを追加
-- （settingsJson の selectedGroupIds からの値移行・読み取り切替は Phase 4 で実施）
ALTER TABLE "ExamSubtotalGroup" ADD COLUMN "selectedForTable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamSubtotalGroup" ADD COLUMN "selectedForBoxPlot" BOOLEAN NOT NULL DEFAULT false;

-- データ移行（既存挙動を保つ）
-- 教員集計 = 旧 statistics（生徒ごと追加した学級=true、登録だけの学級=false）
UPDATE "ExamClass" SET "teacherStat" = "statistics";
-- 生徒表示 = 再採番（administered）の学級のみ
UPDATE "ExamClass" SET "studentReport" = "administered";
