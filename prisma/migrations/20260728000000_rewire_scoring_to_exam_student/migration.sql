-- 採点層の5テーブルを Student 直結から ExamStudent（試験の受験者）経由へ配線し直す。
--
-- これまで StudentAnswerImage / QuestionScore / ScoreDecision / CompoundAnswerScore /
-- ReturnSnapshot は studentId で Student を直接参照していた。ExamStudent を参照する
-- 子テーブルが1つも無かったため「試験から生徒を外す」操作では DB の cascade が働かず、
-- 削除経路の手書き DELETE が取りこぼした行が孤児として残り続けていた。
-- 孤児は試験側の画面・出力（すべて ExamStudent 起点）には現れないのに、成績算出
-- （gradeCalculator は ExamStudent で絞っていなかった）でだけ素点として算入されていた。
--
-- バックフィルは ExamStudent との INNER JOIN で行うため、孤児は自然に落ちる。
-- 破棄は削除確認ダイアログが以前から約束していた挙動であり、仕様変更ではなく仕様への適合。
-- 破棄件数は AuditLog に記録する（起動時のモーダルは data フォルダの手動コピー運用では
-- 最初にそのコピーを開いた人にしか出ず、周知手段として機能しないため）。
--
-- ReturnSnapshot の examId 列は ExamStudent が examId を持つため削除する
-- （両方を保持すると examId と examStudent.examId が食い違いうる）。
--
-- 注: 孤児 StudentAnswerImage が指していた画像ファイルはディスク上に残る。
--     参照が無くなるだけで、実害は使用済み容量のみ。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. 新テーブルの作成とバックフィル ───────────────────────────

-- StudentAnswerImage: ExamPage.examId 経由で ExamStudent に到達する
CREATE TABLE "new_StudentAnswerImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAnswerImage_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "StudentAnswerImage_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_StudentAnswerImage" ("id", "examPageId", "examStudentId", "imagePath", "createdAt", "updatedAt")
SELECT sai."id", sai."examPageId", es."id", sai."imagePath", sai."createdAt", sai."updatedAt"
FROM "StudentAnswerImage" sai
JOIN "ExamPage" ep ON ep."id" = sai."examPageId"
JOIN "ExamStudent" es ON es."examId" = ep."examId" AND es."studentId" = sai."studentId";

-- QuestionScore: CropRegion → ExamPage.examId 経由
CREATE TABLE "new_QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt")
SELECT qs."id", qs."cropRegionId", es."id", qs."partialScore", qs."status", qs."userId", qs."createdAt", qs."updatedAt"
FROM "QuestionScore" qs
JOIN "CropRegion" cr ON cr."id" = qs."cropRegionId"
JOIN "ExamPage" ep ON ep."id" = cr."examPageId"
JOIN "ExamStudent" es ON es."examId" = ep."examId" AND es."studentId" = qs."studentId";

-- ScoreDecision: CropRegion → ExamPage.examId 経由
CREATE TABLE "new_ScoreDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceQuestionScoreId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreDecision_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_ScoreDecision" ("id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "sourceQuestionScoreId", "createdAt", "updatedAt")
SELECT sd."id", sd."cropRegionId", es."id", sd."verdict", sd."score", sd."comment", sd."decidedByUserId", sd."decidedAt", sd."sourceQuestionScoreId", sd."createdAt", sd."updatedAt"
FROM "ScoreDecision" sd
JOIN "CropRegion" cr ON cr."id" = sd."cropRegionId"
JOIN "ExamPage" ep ON ep."id" = cr."examPageId"
JOIN "ExamStudent" es ON es."examId" = ep."examId" AND es."studentId" = sd."studentId";

-- CompoundAnswerScore: CompoundAnswer → ExamPage.examId 経由
CREATE TABLE "new_CompoundAnswerScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundAnswerId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recognizedAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "partialScore" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswerScore_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundAnswerScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CompoundAnswerScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_CompoundAnswerScore" ("id", "compoundAnswerId", "examStudentId", "userId", "recognizedAnswer", "status", "partialScore", "createdAt", "updatedAt")
SELECT cas."id", cas."compoundAnswerId", es."id", cas."userId", cas."recognizedAnswer", cas."status", cas."partialScore", cas."createdAt", cas."updatedAt"
FROM "CompoundAnswerScore" cas
JOIN "CompoundAnswer" ca ON ca."id" = cas."compoundAnswerId"
JOIN "ExamPage" ep ON ep."id" = ca."examPageId"
JOIN "ExamStudent" es ON es."examId" = ep."examId" AND es."studentId" = cas."studentId";

-- ReturnSnapshot: examId を直接保持していたので ExamStudent へ即到達できる。examId 列は落とす
CREATE TABLE "new_ReturnSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examStudentId" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "totalScore" DECIMAL,
    "capturedByUserId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnSnapshot_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_ReturnSnapshot" ("id", "examStudentId", "scoresJson", "totalScore", "capturedByUserId", "capturedAt", "createdAt", "updatedAt")
SELECT rs."id", es."id", rs."scoresJson", rs."totalScore", rs."capturedByUserId", rs."capturedAt", rs."createdAt", rs."updatedAt"
FROM "ReturnSnapshot" rs
JOIN "ExamStudent" es ON es."examId" = rs."examId" AND es."studentId" = rs."studentId";

-- ── 2. 破棄した孤児の件数を監査ログへ記録（1件以上あるときだけ） ──
INSERT INTO "AuditLog" ("id", "createdAt", "updatedAt", "userId", "action", "category", "scopeId", "scopeLabel", "entityType", "entityId", "summary", "metadata")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    NULL,
    'system.migration.cleanup_orphaned_scores',
    'system',
    NULL,
    NULL,
    'System',
    '20260728000000_rewire_scoring_to_exam_student',
    '試験の受験者として登録されていない生徒の採点データ ' ||
        ((SELECT COUNT(*) FROM "StudentAnswerImage") - (SELECT COUNT(*) FROM "new_StudentAnswerImage")
       + (SELECT COUNT(*) FROM "QuestionScore") - (SELECT COUNT(*) FROM "new_QuestionScore")
       + (SELECT COUNT(*) FROM "ScoreDecision") - (SELECT COUNT(*) FROM "new_ScoreDecision")
       + (SELECT COUNT(*) FROM "CompoundAnswerScore") - (SELECT COUNT(*) FROM "new_CompoundAnswerScore")
       + (SELECT COUNT(*) FROM "ReturnSnapshot") - (SELECT COUNT(*) FROM "new_ReturnSnapshot")) ||
        ' 件を、データ移行時に破棄しました。該当する試験では成績算出の結果が変わります。',
    json_object(
        'studentAnswerImage', (SELECT COUNT(*) FROM "StudentAnswerImage") - (SELECT COUNT(*) FROM "new_StudentAnswerImage"),
        'questionScore', (SELECT COUNT(*) FROM "QuestionScore") - (SELECT COUNT(*) FROM "new_QuestionScore"),
        'scoreDecision', (SELECT COUNT(*) FROM "ScoreDecision") - (SELECT COUNT(*) FROM "new_ScoreDecision"),
        'compoundAnswerScore', (SELECT COUNT(*) FROM "CompoundAnswerScore") - (SELECT COUNT(*) FROM "new_CompoundAnswerScore"),
        'returnSnapshot', (SELECT COUNT(*) FROM "ReturnSnapshot") - (SELECT COUNT(*) FROM "new_ReturnSnapshot"),
        'drawingAnnotation', (SELECT COUNT(*) FROM "DrawingAnnotation" WHERE "questionScoreId" NOT IN (SELECT "id" FROM "new_QuestionScore"))
    )
WHERE ((SELECT COUNT(*) FROM "StudentAnswerImage") - (SELECT COUNT(*) FROM "new_StudentAnswerImage")
     + (SELECT COUNT(*) FROM "QuestionScore") - (SELECT COUNT(*) FROM "new_QuestionScore")
     + (SELECT COUNT(*) FROM "ScoreDecision") - (SELECT COUNT(*) FROM "new_ScoreDecision")
     + (SELECT COUNT(*) FROM "CompoundAnswerScore") - (SELECT COUNT(*) FROM "new_CompoundAnswerScore")
     + (SELECT COUNT(*) FROM "ReturnSnapshot") - (SELECT COUNT(*) FROM "new_ReturnSnapshot")) > 0;

-- ── 3. 孤児 QuestionScore にぶら下がる手書き注釈を破棄 ──────────
-- foreign_keys=OFF のため DROP TABLE では cascade しない。明示的に消す。
DELETE FROM "DrawingAnnotation" WHERE "questionScoreId" NOT IN (SELECT "id" FROM "new_QuestionScore");

-- ── 4. 差し替えとインデックス再作成 ──────────────────────────────

DROP TABLE "StudentAnswerImage";
ALTER TABLE "new_StudentAnswerImage" RENAME TO "StudentAnswerImage";
CREATE UNIQUE INDEX "StudentAnswerImage_examPageId_examStudentId_key" ON "StudentAnswerImage"("examPageId", "examStudentId");
CREATE INDEX "StudentAnswerImage_examPageId_idx" ON "StudentAnswerImage"("examPageId");
CREATE INDEX "StudentAnswerImage_examStudentId_idx" ON "StudentAnswerImage"("examStudentId");

DROP TABLE "QuestionScore";
ALTER TABLE "new_QuestionScore" RENAME TO "QuestionScore";
CREATE INDEX "QuestionScore_examStudentId_idx" ON "QuestionScore"("examStudentId");

DROP TABLE "ScoreDecision";
ALTER TABLE "new_ScoreDecision" RENAME TO "ScoreDecision";
CREATE UNIQUE INDEX "ScoreDecision_cropRegionId_examStudentId_key" ON "ScoreDecision"("cropRegionId", "examStudentId");
CREATE INDEX "ScoreDecision_examStudentId_idx" ON "ScoreDecision"("examStudentId");

DROP TABLE "CompoundAnswerScore";
ALTER TABLE "new_CompoundAnswerScore" RENAME TO "CompoundAnswerScore";
CREATE UNIQUE INDEX "CompoundAnswerScore_compoundAnswerId_examStudentId_key" ON "CompoundAnswerScore"("compoundAnswerId", "examStudentId");
CREATE INDEX "CompoundAnswerScore_compoundAnswerId_idx" ON "CompoundAnswerScore"("compoundAnswerId");
CREATE INDEX "CompoundAnswerScore_examStudentId_idx" ON "CompoundAnswerScore"("examStudentId");

DROP TABLE "ReturnSnapshot";
ALTER TABLE "new_ReturnSnapshot" RENAME TO "ReturnSnapshot";
CREATE UNIQUE INDEX "ReturnSnapshot_examStudentId_key" ON "ReturnSnapshot"("examStudentId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
