-- CropRegionの関係をProjectPageに更新

-- 1. 新しいCropRegionテーブル構造を作成
CREATE TABLE CropRegion_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "projectPageId" TEXT NOT NULL,  -- MasterImageIdからProjectPageIdに変更
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegion_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CropRegion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. 既存データを移行（MasterImageIdをProjectPageIdに変換）
INSERT INTO CropRegion_new (
    "id",
    "projectId", 
    "projectPageId",
    "label",
    "type",
    "x",
    "y", 
    "width",
    "height",
    "points",
    "orderIndex",
    "createdAt",
    "updatedAt"
)
SELECT 
    cr.id,
    cr.projectId,
    pp.id as projectPageId,  -- MasterImageからProjectPageに変換
    cr.label,
    cr.type,
    cr.x,
    cr.y,
    cr.width, 
    cr.height,
    cr.points,
    cr.orderIndex,
    cr.createdAt,
    cr.updatedAt
FROM CropRegion cr
JOIN MasterImage mi ON cr.masterImageId = mi.id
JOIN ProjectPage pp ON mi.projectId = pp.projectId AND mi.pageNumber = pp.pageNumber;

-- 3. 古いCropRegionテーブルを削除
DROP TABLE CropRegion;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE CropRegion_new RENAME TO CropRegion;

-- 5. インデックスを作成
CREATE INDEX "CropRegion_projectId_idx" ON "CropRegion"("projectId");
CREATE INDEX "CropRegion_projectPageId_idx" ON "CropRegion"("projectPageId");