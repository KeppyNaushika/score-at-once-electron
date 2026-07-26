-- CreateTable: 設問ごとの採点担当（複数担当可）。
-- idは uuidv5(cropRegionId + userId) の決定論的生成で、2端末が同じペアを
-- 割り当てても行レベルLWWで1行へ収束する（DEFAULTは置かない）。
CREATE TABLE "CropRegionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegionAssignment_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CropRegionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CropRegionAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "CropRegionAssignment_cropRegionId_userId_key" ON "CropRegionAssignment"("cropRegionId", "userId");

-- CreateIndex
CREATE INDEX "CropRegionAssignment_userId_idx" ON "CropRegionAssignment"("userId");
