-- AI採点を類型方式の設問でも使えるよう、AI の層に類型の列を足す（docs/vlm-grading-design.md §4-8-6・§4-8-7 の S6）。
--
--   AiPrompt.renderedScaleLevels                   送った時点の類型の一覧の文（類型方式の設問でなければ ""）
--   AiGradingAttempt.scaleLevelId                  1段目で AI が選んだ類型。類型が消えたら null
--   AiRubricProposalOption.setScaleLevelId         2段目の案の、その類型にする選択肢の類型。類型が消えたら null
--   AiRubricProposalResponseScore.scaleLevelId     問いかけの「自分で採点する」で付けた類型。類型が消えたら null
--   AiAttemptResponse.scaleLevelId                 案の外の問いの答えで付ける類型。類型が消えたら null
--
-- 外部キーつきの nullable な列と既定値つきの列を足すだけ（ALTER TABLE … ADD COLUMN で足せる）。
-- 既存の行の id・時刻・値には触らない（docs/unified-archive-design.md §8 の規約1）。一意制約は置かない。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。

-- AlterTable
ALTER TABLE "AiPrompt" ADD COLUMN "renderedScaleLevels" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "AiGradingAttempt" ADD COLUMN "scaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AiRubricProposalOption" ADD COLUMN "setScaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AiRubricProposalResponseScore" ADD COLUMN "scaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AiAttemptResponse" ADD COLUMN "scaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AiGradingAttempt_scaleLevelId_idx" ON "AiGradingAttempt"("scaleLevelId");

-- CreateIndex
CREATE INDEX "AiRubricProposalOption_setScaleLevelId_idx" ON "AiRubricProposalOption"("setScaleLevelId");

-- CreateIndex
CREATE INDEX "AiRubricProposalResponseScore_scaleLevelId_idx" ON "AiRubricProposalResponseScore"("scaleLevelId");

-- CreateIndex
CREATE INDEX "AiAttemptResponse_scaleLevelId_idx" ON "AiAttemptResponse"("scaleLevelId");
