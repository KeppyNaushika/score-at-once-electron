-- 問いかけで教員が直している助言の文を、案ごと・教員ごとの行に持つ（docs/vlm-grading-design.md §3-5・§5-3）。
--
--   AiRubricProposalAdviceDraft   直している助言の文。答える前から1打鍵ごとに、同じ行をその場で書き換える
--                                 （答えの行 AiRubricProposalResponse は追記なので、打鍵ごとに書くと行が増える）
--
-- 新しい表を足すだけ。既存の行は変えない（AiRubricProposalResponse.adviceText は残すが、もう読まない）。
-- 一意制約は置かない（同じ案・同じ教員の行が複数あれば updatedAt の新しい方が効く）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。

-- CreateTable
CREATE TABLE "AiRubricProposalAdviceDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adviceText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRubricProposalAdviceDraft_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AiRubricProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiRubricProposalAdviceDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiRubricProposalAdviceDraft_proposalId_idx" ON "AiRubricProposalAdviceDraft"("proposalId");

-- CreateIndex
CREATE INDEX "AiRubricProposalAdviceDraft_userId_idx" ON "AiRubricProposalAdviceDraft"("userId");
