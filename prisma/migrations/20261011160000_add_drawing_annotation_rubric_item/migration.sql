-- 助言の朱書きに、文を作った項目を持たせる（docs/vlm-grading-design.md §4-7・§9）。
--
--   DrawingAnnotation.rubricItemId   助言の朱書きの文を作った項目。文がその項目1つの助言そのもの
--                                    （当たっている助言の項目が1つ、または重なった助言の決まりでその項目を
--                                    採った）ならその項目。まとめた一文・並べた文と、手で書いた注釈は null。
--                                    項目を消すと null に戻る
--
-- 問いかけで助言の欄を直しているあいだ、どの朱書きを書き換えるかを、文の一致でなくこの列で見分ける。
--
-- 外部キーつきの nullable な列を足すだけ（既定は NULL なので ALTER TABLE … ADD COLUMN で足せる）。
-- 既存の行は null になり、次に朱書きを合わせたとき（項目の当て外し・助言の変更・問いかけの確定）に入る。
-- 行の id と時刻は変えない（docs/unified-archive-design.md §8 の規約1）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。

-- AlterTable
ALTER TABLE "DrawingAnnotation" ADD COLUMN "rubricItemId" TEXT REFERENCES "RubricItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DrawingAnnotation_rubricItemId_idx" ON "DrawingAnnotation"("rubricItemId");
