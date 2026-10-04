-- 利用者を削除できるようにする（#1140）。
--
-- 利用者を削除したら、その利用者のデータも一緒に消えるのが仕様である
-- （docs/ownership-and-sharing-design.md §4.4）。ところが採点系の3表は User への外部キーが
-- ON DELETE NO ACTION で、列も NOT NULL なので、一度でも採点した利用者は削除が外部キー違反で
-- 失敗していた。この3表を ON DELETE CASCADE へ変え、利用者の削除で一緒に消えるようにする。
--
--   QuestionScore.userId            NO ACTION → CASCADE（子の DrawingAnnotation も消える）
--   ScoreDecision.decidedByUserId   NO ACTION → CASCADE
--   CompoundAnswerScore.userId      NO ACTION → CASCADE
--
-- ReturnSnapshot.capturedByUserId は逆に CASCADE → SET NULL へ緩める。これは「返却版として
-- 記録した人」という実行者の記録で、列も NULL を取る。記録した人を消したからといって、
-- 生徒に返した答案の記録まで消えるのは筋違いである。実行者の記録（UserExam.invitedBy・
-- CropRegionAssignment.assignedBy・GradeFrozenScore.frozenByUserId）と同じ SET NULL に揃える。
--
-- ON UPDATE は schema.prisma で onUpdate: NoAction を明示しているので NO ACTION のまま。
-- それ以外の外部キー・列・索引は元の定義のまま写す（QuestionScore の comment 列は後から
-- ALTER TABLE で足したので末尾にある。並びも元のまま）。
--
-- 既存の表の外部キーは書き換えられないので、表を作り直す。行の値は変えない（同期の
-- トリガーは元の表と一緒に消え、次の setupSync が作り直す）。
--
-- **foreign_keys を落としてから作り直すこと。** ON のまま QuestionScore を DROP すると、
-- 子の DrawingAnnotation がカスケードで消え、それが同期の墓標として他の端末からも消える。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- QuestionScore
CREATE TABLE "new_QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "QuestionScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment") SELECT "id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment" FROM "QuestionScore";
DROP TABLE "QuestionScore";
ALTER TABLE "new_QuestionScore" RENAME TO "QuestionScore";
CREATE INDEX "QuestionScore_examStudentId_idx" ON "QuestionScore"("examStudentId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");

-- ScoreDecision
CREATE TABLE "new_ScoreDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreDecision_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_ScoreDecision" ("id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "createdAt", "updatedAt") SELECT "id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "createdAt", "updatedAt" FROM "ScoreDecision";
DROP TABLE "ScoreDecision";
ALTER TABLE "new_ScoreDecision" RENAME TO "ScoreDecision";
CREATE UNIQUE INDEX "ScoreDecision_cropRegionId_examStudentId_key" ON "ScoreDecision"("cropRegionId", "examStudentId");
CREATE INDEX "ScoreDecision_examStudentId_idx" ON "ScoreDecision"("examStudentId");

-- CompoundAnswerScore
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
    CONSTRAINT "CompoundAnswerScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_CompoundAnswerScore" ("id", "compoundAnswerId", "examStudentId", "userId", "recognizedAnswer", "status", "partialScore", "createdAt", "updatedAt") SELECT "id", "compoundAnswerId", "examStudentId", "userId", "recognizedAnswer", "status", "partialScore", "createdAt", "updatedAt" FROM "CompoundAnswerScore";
DROP TABLE "CompoundAnswerScore";
ALTER TABLE "new_CompoundAnswerScore" RENAME TO "CompoundAnswerScore";
CREATE UNIQUE INDEX "CompoundAnswerScore_compoundAnswerId_examStudentId_key" ON "CompoundAnswerScore"("compoundAnswerId", "examStudentId");
CREATE INDEX "CompoundAnswerScore_compoundAnswerId_idx" ON "CompoundAnswerScore"("compoundAnswerId");
CREATE INDEX "CompoundAnswerScore_examStudentId_idx" ON "CompoundAnswerScore"("examStudentId");

-- ReturnSnapshot
CREATE TABLE "new_ReturnSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examStudentId" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "totalScore" DECIMAL,
    "capturedByUserId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnSnapshot_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ReturnSnapshot_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
INSERT INTO "new_ReturnSnapshot" ("id", "examStudentId", "scoresJson", "totalScore", "capturedByUserId", "capturedAt", "createdAt", "updatedAt") SELECT "id", "examStudentId", "scoresJson", "totalScore", "capturedByUserId", "capturedAt", "createdAt", "updatedAt" FROM "ReturnSnapshot";
DROP TABLE "ReturnSnapshot";
ALTER TABLE "new_ReturnSnapshot" RENAME TO "ReturnSnapshot";
CREATE UNIQUE INDEX "ReturnSnapshot_examStudentId_key" ON "ReturnSnapshot"("examStudentId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
