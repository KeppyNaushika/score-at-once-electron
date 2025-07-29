-- QuestionSubtotalAssignment テーブルのカラム名を更新

-- 1. 新しいテーブル構造を作成
CREATE TABLE QuestionSubtotalAssignment_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,     -- questionLayoutRegionId から変更
    "subtotalId" TEXT NOT NULL,       -- questionGroupItemId から変更  
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionSubtotalAssignment_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionSubtotalAssignment_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. データをコピー（列名を変更してコピー）
INSERT INTO QuestionSubtotalAssignment_new 
SELECT 
    id,
    questionLayoutRegionId as cropRegionId,  -- 列名を変更してコピー
    questionGroupItemId as subtotalId,       -- 列名を変更してコピー
    createdAt,
    updatedAt
FROM QuestionSubtotalAssignment;

-- 3. 古いテーブルを削除
DROP TABLE QuestionSubtotalAssignment;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE QuestionSubtotalAssignment_new RENAME TO QuestionSubtotalAssignment;

-- 5. インデックスを再作成
CREATE INDEX "QuestionSubtotalAssignment_cropRegionId_idx" ON "QuestionSubtotalAssignment"("cropRegionId");
CREATE INDEX "QuestionSubtotalAssignment_subtotalId_idx" ON "QuestionSubtotalAssignment"("subtotalId");
CREATE UNIQUE INDEX "QuestionSubtotalAssignment_cropRegionId_subtotalId_key" ON "QuestionSubtotalAssignment"("cropRegionId", "subtotalId");