-- 観点ごとに採点マークの色を変える（issue #1543）。
--
--   Subtotal.markColor                  小計項目の採点マークの色（HEX）。null なら試験全体の色
--   SubtotalGroup.order                 小計点管理での並び。色の優先にも使う
--   Exam.subtotalMarkColorEnabled       小計項目の色を使うか（9. 結果と出力のスイッチ。既定は ON）
--
-- 既定値つきの列と nullable な列を足すだけ（ALTER TABLE … ADD COLUMN で足せる）。
-- 既存の行の id・時刻・値には触らない（docs/unified-archive-design.md §8 の規約1）。
-- SubtotalGroup.order は既存の行がすべて 0 になる。並びは order の昇順・同じ値は createdAt の
-- 新しい順なので、今までの並び（createdAt の新しい順）がそのまま保たれる。他の行を見て番号を
-- 振り直すことはしない（グループは範囲の外の表なので、一部だけの DB と結果がずれる。規約2）。

-- AlterTable
ALTER TABLE "Subtotal" ADD COLUMN "markColor" TEXT;

-- AlterTable
ALTER TABLE "SubtotalGroup" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN "subtotalMarkColorEnabled" BOOLEAN NOT NULL DEFAULT true;
