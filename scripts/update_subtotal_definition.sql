-- SubtotalDefinition テーブルのカラム名を更新

-- 1. 新しいテーブル構造を作成
CREATE TABLE SubtotalDefinition_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,  -- layoutRegionId から変更  
    "subtotalId" TEXT NOT NULL,    -- questionGroupItemId から変更
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubtotalDefinition_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubtotalDefinition_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. データをコピー（列名を変更してコピー）
INSERT INTO SubtotalDefinition_new 
SELECT 
    id,
    layoutRegionId as cropRegionId,      -- 列名を変更してコピー
    questionGroupItemId as subtotalId,   -- 列名を変更してコピー
    createdAt,
    updatedAt
FROM SubtotalDefinition;

-- 3. 古いテーブルを削除
DROP TABLE SubtotalDefinition;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE SubtotalDefinition_new RENAME TO SubtotalDefinition;

-- 5. インデックスを再作成
CREATE INDEX "SubtotalDefinition_cropRegionId_idx" ON "SubtotalDefinition"("cropRegionId");
CREATE INDEX "SubtotalDefinition_subtotalId_idx" ON "SubtotalDefinition"("subtotalId");
CREATE UNIQUE INDEX "SubtotalDefinition_cropRegionId_subtotalId_key" ON "SubtotalDefinition"("cropRegionId", "subtotalId");