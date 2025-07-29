-- CropRegionからprojectIdフィールドを削除（ProjectPage経由でアクセス可能のため冗長）

-- 1. 新しいCropRegionテーブル構造を作成（projectIdを削除）
CREATE TABLE CropRegion_clean (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,  -- ProjectPageにのみリレーション
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
    CONSTRAINT "CropRegion_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. 既存データを移行（projectIdを除外）
INSERT INTO CropRegion_clean (
    "id",
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
    id,
    projectPageId,
    label,
    type,
    x,
    y,
    width,
    height,
    points,
    orderIndex,
    createdAt,
    updatedAt
FROM CropRegion;

-- 3. 古いCropRegionテーブルを削除
DROP TABLE CropRegion;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE CropRegion_clean RENAME TO CropRegion;

-- 5. インデックスを作成
CREATE INDEX "CropRegion_projectPageId_idx" ON "CropRegion"("projectPageId");