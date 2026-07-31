-- 置き換え済みの採点マーク設定テーブル ExamMarkingFormat を撤去する。
--
-- ExamMarkingFormat は「記号を文字（symbol）で持ち、色と文字サイズ・線幅で描く」旧方式。
-- 現行の採点マークは public/score-assets の画像 ＋ ExamExportSettings.settingsJson の
-- scoringMarkConfig（位置・オフセット・不透明度・ステータス別の表示切替）へ置き換わっており、
-- このテーブルを読み書きする UI は存在しない。
--
-- 残っていたのはアーカイブの入出力経路だけで、エクスポート時に読み出し、インポート時に
-- 書き戻すという往復により、アプリ内で作る手段も使う手段も無いデータが運ばれ続けていた。
-- アーカイブ側は 1.22.0 の変換器で読み捨てる。

DROP TABLE IF EXISTS "ExamMarkingFormat";
