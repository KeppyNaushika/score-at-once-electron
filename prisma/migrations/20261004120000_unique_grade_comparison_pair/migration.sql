-- 比較（GradeComparison）の (gradeItemId, comparedGradeItemId) に UNIQUE を張る。
--
-- 作ったとき（20260929120000_add_grade_comparison）は、別端末が同時に同じ組を足すと
-- 同期で別 id・同一キーの行がぶつかるとして UNIQUE を置かなかった。sqlite-nas-sync 0.20.0
-- からは、ぶつかった行は LWW で勝った方だけが表に入り、負けた方は隠れるだけで同期は
-- 止まらない。鍵は uuid 2つなので、同値になるのは「同じ組を2回足した」ときだけで、
-- 1行へ統合するのが正しい。
--
-- 索引を張る前に、同じ組の重複を1行へ畳む。**残すのは id がいちばん小さい行**で、
-- どの端末で走らせても同じ答えになる（20260823120000_subtotal_uniques_by_uuid と同じ）。
-- 重複は画面で防いでいたが、同期を通した DB には在りうる。比較は子を持たない。
DELETE FROM "GradeComparison"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "GradeComparison"
  GROUP BY "gradeItemId", "comparedGradeItemId"
);

CREATE UNIQUE INDEX "GradeComparison_gradeItemId_comparedGradeItemId_key" ON "GradeComparison"("gradeItemId", "comparedGradeItemId");
