-- SubtotalGroupテーブルからprojectIdを削除（多対多関係に移行済み）

-- 1. 新しいSubtotalGroupテーブル構造を作成（projectId削除）
CREATE TABLE SubtotalGroup_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. データをコピー（projectIdを除外）
INSERT INTO SubtotalGroup_new (id, name, createdAt, updatedAt)
SELECT id, name, createdAt, updatedAt
FROM SubtotalGroup;

-- 3. 古いテーブルを削除
DROP TABLE SubtotalGroup;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE SubtotalGroup_new RENAME TO SubtotalGroup;