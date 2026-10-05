-- 試験の参加者のロールを OWNER / EDITOR / VIEWER の3つにし、結果出力の許可を足す
-- （docs/scoring-scope-and-permissions-design.md §3-3、2026-10-05 OWNER 裁定）。
--
--   role             'GRADER' → 'EDITOR'。既定値も 'EDITOR' へ。OWNER はそのまま
--   canExportResults 新しい列。09 結果出力を使えるか（効くのは EDITOR だけ）。
--                    既存の採点者が結果出力を失わないよう、既定は許可（true）
--
-- 列の既定値は書き換えられないので、表を作り直す。id と時刻は変えない
-- （docs/unified-archive-design.md §8 の1）。ロールの書き換えはどの端末でも同じ結果になる。
-- UserExam を参照する表は無いので、作り直しで外部キーがずれることはない。同期のトリガーは
-- 元の表と一緒に消え、次の setupSync が作り直す。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_UserExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "canExportResults" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "UserExam_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
INSERT INTO "new_UserExam" ("id", "userId", "examId", "role", "canExportResults", "invitedAt", "invitedBy", "createdAt", "updatedAt")
SELECT "id", "userId", "examId", CASE "role" WHEN 'GRADER' THEN 'EDITOR' ELSE "role" END, true, "invitedAt", "invitedBy", "createdAt", "updatedAt" FROM "UserExam";
DROP TABLE "UserExam";
ALTER TABLE "new_UserExam" RENAME TO "UserExam";
CREATE INDEX "UserExam_examId_idx" ON "UserExam"("examId");
CREATE UNIQUE INDEX "UserExam_userId_examId_key" ON "UserExam"("userId", "examId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
