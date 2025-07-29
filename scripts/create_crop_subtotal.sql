-- CropSubtotal テーブルを作成（SubtotalDefinition + QuestionSubtotalAssignment を統合）

CREATE TABLE CropSubtotal (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "subtotalId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,  -- 'SUBTOTAL_DEFINITION' or 'QUESTION_ASSIGNMENT'
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropSubtotal_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CropSubtotal_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- インデックスを作成
CREATE UNIQUE INDEX "CropSubtotal_cropRegionId_subtotalId_assignmentType_key" ON "CropSubtotal"("cropRegionId", "subtotalId", "assignmentType");
CREATE INDEX "CropSubtotal_cropRegionId_idx" ON "CropSubtotal"("cropRegionId");
CREATE INDEX "CropSubtotal_subtotalId_idx" ON "CropSubtotal"("subtotalId");