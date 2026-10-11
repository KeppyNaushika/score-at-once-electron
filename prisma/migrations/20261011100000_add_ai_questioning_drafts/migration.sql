-- AI 採点の問いかけを「問いに答える（下書き）→ 最後に見直して確定」の形にする
-- （docs/vlm-grading-design.md §3-5）。
--
--   AiRubricProposalResponse.committedAt   確定した日時。下書きは NULL
--   AiRubricProposalResponseScore           「1件ずつ自分で採点する」で答案ごとに付けた点（答えの一部）
--   AiAttemptResponse                       案の外の問いかけ（採点チェック・どの案にも入らない答案）への
--                                           答えを答案（試行）ごとに
--   AiGradingRun.questioningScoringMethod   問いかけの前に決めた採点方式の下書き。既定 ''
--
-- 新しい表と、列を足すだけ。これまでの答えは答えたその場で教員の層へ書いていたので、
-- 確定済みとして自分の行の作成日時を写す（他の行は参照しない。id・createdAt・updatedAt は変えない。
-- docs/unified-archive-design.md §8）。一意制約は置かない。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。

-- AlterTable
ALTER TABLE "AiRubricProposalResponse" ADD COLUMN "committedAt" DATETIME;

UPDATE "AiRubricProposalResponse" SET "committedAt" = "createdAt";

-- AlterTable
ALTER TABLE "AiGradingRun" ADD COLUMN "questioningScoringMethod" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "AiRubricProposalResponseScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalResponseScore_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AiRubricProposalResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalResponseScore_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AiGradingAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiAttemptResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "status" TEXT,
    "partialScore" DECIMAL,
    "committedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAttemptResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AiGradingAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiRubricProposalResponseScore_responseId_idx" ON "AiRubricProposalResponseScore"("responseId");

-- CreateIndex
CREATE INDEX "AiRubricProposalResponseScore_attemptId_idx" ON "AiRubricProposalResponseScore"("attemptId");

-- CreateIndex
CREATE INDEX "AiAttemptResponse_attemptId_idx" ON "AiAttemptResponse"("attemptId");
