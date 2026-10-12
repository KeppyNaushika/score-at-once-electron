-- 類型評価の類型（ScoreScaleLevel）の点を、配点に掛ける割合から点数そのものへ変える
-- （docs/vlm-grading-design.md §4-8-3）。
--
--   ScoreScaleLevel.ratio → score   その類型を付けた答案の点（0 以上。配点を超えてよい）
--
-- 20261012120000 で足した列の意味を変えて名前を付け直す。値は書き換えない（割合だった値は、
-- そのまま点数として読まれる。20261012120000 を当てたのは開発中の DB だけで、類型を付けた採点はまだ無い）。
-- 列はデータ列で、外部キーでも外部キーの参照先でもないので、名前を変えても dangling は生じない。
-- 行の id と時刻は変えない（docs/unified-archive-design.md §8 の規約1）。
ALTER TABLE "ScoreScaleLevel" RENAME COLUMN "ratio" TO "score";
