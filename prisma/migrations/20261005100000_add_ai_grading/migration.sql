-- AI 採点（VLM 採点）の記録を置く表を3つ作る（docs/vlm-grading-design.md §4-2）。
--
--   AiPrompt          設問ごとのプロンプト（問題文・模範解答・採点基準）。書き換えず、直すたびに
--                     parentPromptId を元に向けた新しい行を作る
--   AiGradingRun      1回の実行（採点 / プロンプトの改訂）。実行した教員のもの
--   AiGradingAttempt  答案1件への AI の1回の判定。id をそのまま事業者への custom_id に使う
--
-- AI の判定は QuestionScore とは別に持つ。確認前の点がリゾルバを通って出力・成績算出に
-- 流れ込まないように、また教員が直しても AI の元の判定が残るように。教員が採用したときだけ、
-- その教員自身の QuestionScore と注釈へ写す（写した先を adopted* に記録する）。
--
-- 新しい表を作るだけで、既存の行には触らない（docs/unified-archive-design.md §8）。
-- 一意制約は置かない（uuid 以外の値を unique にしない）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。
CREATE TABLE "AiPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "parentPromptId" TEXT,
    "createdByUserId" TEXT,
    "questionText" TEXT NOT NULL DEFAULT '',
    "questionImagePath" TEXT,
    "modelAnswerText" TEXT NOT NULL DEFAULT '',
    "sendModelAnswerImage" BOOLEAN NOT NULL DEFAULT false,
    "rubricText" TEXT NOT NULL DEFAULT '',
    "revisionInstruction" TEXT NOT NULL DEFAULT '',
    "revisionMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiPrompt_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiPrompt_parentPromptId_fkey" FOREIGN KEY ("parentPromptId") REFERENCES "AiPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiPrompt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiGradingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "externalBatchId" TEXT,
    "submittedClientId" TEXT NOT NULL,
    "imageScale" REAL NOT NULL DEFAULT 1,
    "points" DECIMAL,
    "resultPromptId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiGradingRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGradingRun_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGradingRun_resultPromptId_fkey" FOREIGN KEY ("resultPromptId") REFERENCES "AiPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiGradingAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "partialScore" DECIMAL,
    "comment" TEXT NOT NULL DEFAULT '',
    "annotationText" TEXT NOT NULL DEFAULT '',
    "transcription" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "adoptedQuestionScoreId" TEXT,
    "adoptedDrawingAnnotationId" TEXT,
    "adoptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiGradingAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiGradingRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGradingAttempt_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGradingAttempt_adoptedQuestionScoreId_fkey" FOREIGN KEY ("adoptedQuestionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiGradingAttempt_adoptedDrawingAnnotationId_fkey" FOREIGN KEY ("adoptedDrawingAnnotationId") REFERENCES "DrawingAnnotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AiPrompt_cropRegionId_idx" ON "AiPrompt"("cropRegionId");

CREATE INDEX "AiGradingRun_userId_idx" ON "AiGradingRun"("userId");

CREATE INDEX "AiGradingRun_promptId_idx" ON "AiGradingRun"("promptId");

CREATE INDEX "AiGradingAttempt_runId_idx" ON "AiGradingAttempt"("runId");

CREATE INDEX "AiGradingAttempt_examStudentId_idx" ON "AiGradingAttempt"("examStudentId");
