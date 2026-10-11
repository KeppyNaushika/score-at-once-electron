-- 問いかけで教員が直した助言の文を、案への答え（下書き）に持たせる
-- （docs/vlm-grading-design.md §3-5・§5-3）。
--
--   AiRubricProposalResponse.adviceText   直した助言の文。null は直していない（既存の項目に当たる案は
--                                         その項目の助言、ほかは AI の文案 adviceDraft のまま）。"" は助言なし
--
-- 列を足すだけ（nullable なので既定値は要らない）。既存の行は null（直していない）になる。
-- 行の id と時刻は変えない（docs/unified-archive-design.md §8 の規約1）。

-- AlterTable
ALTER TABLE "AiRubricProposalResponse" ADD COLUMN "adviceText" TEXT;
