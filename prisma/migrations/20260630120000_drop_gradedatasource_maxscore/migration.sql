-- GradeDataSource.maxScore（満点スナップショット列）を廃止する。
--
-- 満点は元データ（CropRegion.points / CourseworkItem.maxScore）から
-- computeLiveMaxScore で常時ライブ算出する設計へ移行済み。表示・計算・Excel出力・
-- アーカイブはすべて算出値を使用するため、この列は不要になった。
-- （手動上書きによる二重管理・元データとのドリフトを排除する。）
ALTER TABLE "GradeDataSource" DROP COLUMN "maxScore";
