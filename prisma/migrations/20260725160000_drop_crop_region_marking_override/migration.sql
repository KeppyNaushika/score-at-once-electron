-- CropRegionMarkingOverride（設問別の採点マーク上書き）を廃止する
--
-- 設定UIも出力描画への反映も一度も実装されず、値が入る経路が存在しないまま
-- 入出力・同期の保守コストだけが発生していたため、モデルごと削除する（issue #852）。
-- 実データを持ち得ないテーブルなので、退避は行わない。
DROP INDEX IF EXISTS "CropRegionMarkingOverride_cropRegionId_markType_key";
DROP INDEX IF EXISTS "CropRegionMarkingOverride_cropRegionId_idx";
DROP TABLE IF EXISTS "CropRegionMarkingOverride";
