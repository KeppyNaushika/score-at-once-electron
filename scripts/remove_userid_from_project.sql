-- ProjectテーブルからuserIdを削除（多対多関係に移行済み）

-- 1. 新しいProjectテーブル構造を作成（userId削除）
CREATE TABLE Project_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. データをコピー（userIdを除外）
INSERT INTO Project_new (id, examName, examDate, subject, description, createdAt, updatedAt)
SELECT id, examName, examDate, subject, description, createdAt, updatedAt
FROM Project;

-- 3. 古いテーブルを削除
DROP TABLE Project;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE Project_new RENAME TO Project;