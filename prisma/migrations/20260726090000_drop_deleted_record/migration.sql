-- DeletedRecord（アプリ側 tombstone）を廃止する
--
-- 削除の伝搬は sqlite-nas-sync の内部テーブル `_tombstone` が担う。こちらは
-- 全同期テーブルの AFTER DELETE トリガーで自動記録され、deletedAt と updatedAt の
-- LWW で「最新の更新 > 最新の削除なら存続」へ決定論的に収束する。
--
-- 対して DeletedRecord は、同期後に時刻を無視した無条件 DELETE を実行する
-- 永久の kill-list として働いていた（enforceTombstones）。アーカイブを正本とし
-- import では忠実に復元する方針と正面から矛盾するため、機構ごと削除する（issue #918）。
--
-- 行は tombstone のみで復元対象の実データを持たないため、退避は行わない。
DROP INDEX IF EXISTS "DeletedRecord_tableName_recordId_key";
DROP INDEX IF EXISTS "DeletedRecord_examId_idx";
DROP INDEX IF EXISTS "DeletedRecord_deletedAt_idx";
DROP TABLE IF EXISTS "DeletedRecord";
