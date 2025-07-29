-- Subtotal テーブルの questionGroupId を subtotalGroupId に変更

-- 1. 新しいテーブル構造を作成
CREATE TABLE Subtotal_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,  -- questionGroupId から変更
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subtotal_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. データをコピー（列名を変更してコピー）
INSERT INTO Subtotal_new 
SELECT 
    id,
    name,
    questionGroupId as subtotalGroupId,  -- 列名を変更してコピー
    "order",
    createdAt,
    updatedAt
FROM Subtotal;

-- 3. 古いテーブルを削除
DROP TABLE Subtotal;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE Subtotal_new RENAME TO Subtotal;

-- 5. インデックスを再作成
CREATE INDEX "Subtotal_subtotalGroupId_idx" ON "Subtotal"("subtotalGroupId");
CREATE INDEX "Subtotal_subtotalGroupId_order_idx" ON "Subtotal"("subtotalGroupId", "order");
CREATE UNIQUE INDEX "Subtotal_subtotalGroupId_name_key" ON "Subtotal"("subtotalGroupId", "name");