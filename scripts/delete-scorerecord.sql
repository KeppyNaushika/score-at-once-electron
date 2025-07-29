-- ScoreRecord テーブル削除スクリプト

-- 外部キー制約を一時的に無効化
PRAGMA foreign_keys = OFF;

-- テーブルの削除
DROP TABLE IF EXISTS "ScoreRecord";

-- 外部キー制約を再度有効化
PRAGMA foreign_keys = ON;

-- 削除後の確認用クエリ
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;