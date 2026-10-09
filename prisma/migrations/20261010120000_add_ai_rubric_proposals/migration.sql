-- AI 採点の層に、1段目の所見と当てはまり・2段目の項目の案と教員の答えを足す
-- （docs/vlm-grading-design.md §3・§5-3 の R5）。
--
--   AiAttemptRubricMatch          1段目が「既存の項目が当てはまる」と返したもの（試行 × 項目）
--   AiRubricProposal              2段目が返した項目の案
--   AiRubricProposalOption        案の選択肢（効き方は RubricItem と同じ形）
--   AiRubricProposalMember        案に入る答案（試行）
--   AiRubricProposalResponse      問いかけへの教員の答え（答え直しは新しい行）
--   AiPrompt.renderedRubricItems  送った時点の項目の一覧の文。既定 ''
--   AiGradingRun.notes            2段目が返した気づいた点。既定 ''
--   AiGradingAttempt.observation  1段目の所見。既定 ''
--
-- 新しい表と、既定値つきの列を足すだけで、既存の行の id・時刻・値には触らない
-- （docs/unified-archive-design.md §8）。列は消さない（annotationText・revisionInstruction・
-- revisionMessage・resultPromptId を消すかは別に決める）。一意制約は置かない。
-- 外部キーは AI の層から教員の層（RubricItem）へ向くものだけ。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。
CREATE TABLE "AiAttemptRubricMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "rubricItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAttemptRubricMatch_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AiGradingAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiAttemptRubricMatch_rubricItemId_fkey" FOREIGN KEY ("rubricItemId") REFERENCES "RubricItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiRubricProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "adviceDraft" TEXT NOT NULL DEFAULT '',
    "matchedRubricItemId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiGradingRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposal_matchedRubricItemId_fkey" FOREIGN KEY ("matchedRubricItemId") REFERENCES "RubricItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiRubricProposalOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "effectKind" TEXT NOT NULL,
    "pointDelta" DECIMAL,
    "setStatus" TEXT,
    "setScore" DECIMAL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalOption_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AiRubricProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiRubricProposalMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalMember_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AiRubricProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalMember_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AiGradingAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiRubricProposalResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "optionId" TEXT,
    "freeText" TEXT NOT NULL DEFAULT '',
    "resultRubricItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalResponse_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AiRubricProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AiRubricProposalOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalResponse_resultRubricItemId_fkey" FOREIGN KEY ("resultRubricItemId") REFERENCES "RubricItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiAttemptRubricMatch_attemptId_idx" ON "AiAttemptRubricMatch"("attemptId");

-- CreateIndex
CREATE INDEX "AiAttemptRubricMatch_rubricItemId_idx" ON "AiAttemptRubricMatch"("rubricItemId");

-- CreateIndex
CREATE INDEX "AiRubricProposal_runId_idx" ON "AiRubricProposal"("runId");

-- CreateIndex
CREATE INDEX "AiRubricProposal_matchedRubricItemId_idx" ON "AiRubricProposal"("matchedRubricItemId");

-- CreateIndex
CREATE INDEX "AiRubricProposalOption_proposalId_idx" ON "AiRubricProposalOption"("proposalId");

-- CreateIndex
CREATE INDEX "AiRubricProposalMember_proposalId_idx" ON "AiRubricProposalMember"("proposalId");

-- CreateIndex
CREATE INDEX "AiRubricProposalMember_attemptId_idx" ON "AiRubricProposalMember"("attemptId");

-- CreateIndex
CREATE INDEX "AiRubricProposalResponse_proposalId_idx" ON "AiRubricProposalResponse"("proposalId");

-- CreateIndex
CREATE INDEX "AiRubricProposalResponse_optionId_idx" ON "AiRubricProposalResponse"("optionId");

-- CreateIndex
CREATE INDEX "AiRubricProposalResponse_resultRubricItemId_idx" ON "AiRubricProposalResponse"("resultRubricItemId");

-- AlterTable
ALTER TABLE "AiPrompt" ADD COLUMN "renderedRubricItems" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "AiGradingRun" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "AiGradingAttempt" ADD COLUMN "observation" TEXT NOT NULL DEFAULT '';
