-- AI 採点の作り直し（docs/vlm-grading-design.md §14）で使わなくなった列を落とし、問いかけの
-- 「その他」の欄の文を1打鍵ごとに書く表を足す。
--
-- 落とす列（どれもアプリはもう読み書きしていない）:
--
--   AiPrompt.questionImagePath             問題の画像（1枚）。値は 20261011120000 で AiPromptQuestionImage へ写した
--   AiPrompt.revisionInstruction           廃止したプロンプトの改訂（VLM に直させる）の指示文
--   AiPrompt.revisionMessage               同じく、改訂した VLM からの説明
--   AiGradingRun.resultPromptId            同じく、改訂でできたプロンプト（改訂の実行の行そのものは費用の記録として残る）
--   AiGradingAttempt.comment               1段目が返していた教員向けの配点理由（今は所見 observation を返す）
--   AiGradingAttempt.annotationText        1段目が返していた朱書きの文案（朱書きは項目の助言から作る）
--   AiGradingAttempt.adoptedQuestionScoreId  廃止した「採用」（判定をそのまま自分の採点にする）で書いた採点行
--   AiGradingAttempt.adoptedDrawingAnnotationId  同じく、採用で書いた注釈（注釈そのものは残る）
--   AiGradingAttempt.adoptedAt             同じく、採用した日時
--   AiRubricProposalResponse.adviceText    問いかけで直した助言の文。20261011140000 から AiRubricProposalAdviceDraft に持つ
--
-- 足す表:
--
--   AiRubricProposalInstructionDraft       問いかけの「その他：再採点を指示する」の欄に書いている文。案ごと・教員ごとの
--                                          行を1打鍵ごとにその場で書き換える（答えの行 AiRubricProposalResponse は追記なので）
--
-- 列は ALTER TABLE … DROP COLUMN ではなく表の作り直しで落とす。同期のトリガーは列を名指しで読むので、
-- DROP COLUMN で列だけ消すと、そのトリガーが壊れたまま残り、次の DROP COLUMN / RENAME（DB の全トリガーを
-- 読み直す）が落ちる。作り直しなら古い表とともにトリガーも消え、同期の準備（setupSync）が作り直す。
-- 外部キーを持つ列（resultPromptId・adopted*）はどのみち DROP COLUMN できない。
--
-- 行の id と時刻は変えず、残す列はそのまま写す（docs/unified-archive-design.md §8 の規約1）。
-- 新しい表には一意制約を置かない（sqlite-nas-sync の制約）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。
-- 作り直す表の列は、ここまでの migration で足した列（annotationInstruction・renderedRubricItems・notes・
-- questioningScoringMethod・observation・committedAt）を含めて今の schema.prisma と同じにする。

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AiPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "parentPromptId" TEXT,
    "createdByUserId" TEXT,
    "questionText" TEXT NOT NULL DEFAULT '',
    "modelAnswerText" TEXT NOT NULL DEFAULT '',
    "sendModelAnswerImage" BOOLEAN NOT NULL DEFAULT false,
    "rubricText" TEXT NOT NULL DEFAULT '',
    "annotationInstruction" TEXT NOT NULL DEFAULT '',
    "renderedRubricItems" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiPrompt_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiPrompt_parentPromptId_fkey" FOREIGN KEY ("parentPromptId") REFERENCES "AiPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiPrompt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiPrompt" ("id", "cropRegionId", "parentPromptId", "createdByUserId", "questionText", "modelAnswerText", "sendModelAnswerImage", "rubricText", "annotationInstruction", "renderedRubricItems", "createdAt", "updatedAt")
SELECT "id", "cropRegionId", "parentPromptId", "createdByUserId", "questionText", "modelAnswerText", "sendModelAnswerImage", "rubricText", "annotationInstruction", "renderedRubricItems", "createdAt", "updatedAt"
FROM "AiPrompt";
DROP TABLE "AiPrompt";
ALTER TABLE "new_AiPrompt" RENAME TO "AiPrompt";
CREATE INDEX "AiPrompt_cropRegionId_idx" ON "AiPrompt"("cropRegionId");

CREATE TABLE "new_AiGradingRun" (
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
    "notes" TEXT NOT NULL DEFAULT '',
    "questioningScoringMethod" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiGradingRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGradingRun_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiGradingRun" ("id", "userId", "promptId", "purpose", "templateVersion", "provider", "model", "effort", "mode", "status", "externalBatchId", "submittedClientId", "imageScale", "points", "notes", "questioningScoringMethod", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "endedAt", "createdAt", "updatedAt")
SELECT "id", "userId", "promptId", "purpose", "templateVersion", "provider", "model", "effort", "mode", "status", "externalBatchId", "submittedClientId", "imageScale", "points", "notes", "questioningScoringMethod", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "endedAt", "createdAt", "updatedAt"
FROM "AiGradingRun";
DROP TABLE "AiGradingRun";
ALTER TABLE "new_AiGradingRun" RENAME TO "AiGradingRun";
CREATE INDEX "AiGradingRun_userId_idx" ON "AiGradingRun"("userId");
CREATE INDEX "AiGradingRun_promptId_idx" ON "AiGradingRun"("promptId");

CREATE TABLE "new_AiGradingAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "partialScore" DECIMAL,
    "transcription" TEXT NOT NULL DEFAULT '',
    "observation" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiGradingAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiGradingRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGradingAttempt_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiGradingAttempt" ("id", "runId", "examStudentId", "state", "status", "partialScore", "transcription", "observation", "confidence", "errorMessage", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "createdAt", "updatedAt")
SELECT "id", "runId", "examStudentId", "state", "status", "partialScore", "transcription", "observation", "confidence", "errorMessage", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "createdAt", "updatedAt"
FROM "AiGradingAttempt";
DROP TABLE "AiGradingAttempt";
ALTER TABLE "new_AiGradingAttempt" RENAME TO "AiGradingAttempt";
CREATE INDEX "AiGradingAttempt_runId_idx" ON "AiGradingAttempt"("runId");
CREATE INDEX "AiGradingAttempt_examStudentId_idx" ON "AiGradingAttempt"("examStudentId");

CREATE TABLE "new_AiRubricProposalResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "optionId" TEXT,
    "freeText" TEXT NOT NULL DEFAULT '',
    "resultRubricItemId" TEXT,
    "committedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalResponse_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AiRubricProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AiRubricProposalOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalResponse_resultRubricItemId_fkey" FOREIGN KEY ("resultRubricItemId") REFERENCES "RubricItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiRubricProposalResponse" ("id", "proposalId", "optionId", "freeText", "resultRubricItemId", "committedAt", "createdAt", "updatedAt")
SELECT "id", "proposalId", "optionId", "freeText", "resultRubricItemId", "committedAt", "createdAt", "updatedAt"
FROM "AiRubricProposalResponse";
DROP TABLE "AiRubricProposalResponse";
ALTER TABLE "new_AiRubricProposalResponse" RENAME TO "AiRubricProposalResponse";
CREATE INDEX "AiRubricProposalResponse_proposalId_idx" ON "AiRubricProposalResponse"("proposalId");
CREATE INDEX "AiRubricProposalResponse_optionId_idx" ON "AiRubricProposalResponse"("optionId");
CREATE INDEX "AiRubricProposalResponse_resultRubricItemId_idx" ON "AiRubricProposalResponse"("resultRubricItemId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "AiRubricProposalInstructionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instructionText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalInstructionDraft_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AiRubricProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalInstructionDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiRubricProposalInstructionDraft_proposalId_idx" ON "AiRubricProposalInstructionDraft"("proposalId");

-- CreateIndex
CREATE INDEX "AiRubricProposalInstructionDraft_userId_idx" ON "AiRubricProposalInstructionDraft"("userId");
