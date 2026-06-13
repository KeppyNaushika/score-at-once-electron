-- AlterTable
ALTER TABLE "AsbSubQuestion" ADD COLUMN "manuscriptCharGuides" TEXT;
ALTER TABLE "AsbSubQuestion" ADD COLUMN "manuscriptGuideFontSize" REAL;
ALTER TABLE "AsbSubQuestion" ADD COLUMN "manuscriptGuidePosition" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AsbDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '新しい解答用紙',
    "renderMode" TEXT NOT NULL DEFAULT 'answer-sheet',
    "labelPresetMajor" TEXT,
    "labelPresetSub" TEXT,
    "labelPresetBranch" TEXT,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "verticalLayout" BOOLEAN NOT NULL DEFAULT false,
    "baseRowHeight" REAL NOT NULL DEFAULT 12,
    "numberDisplayMode" TEXT NOT NULL DEFAULT 'multirow',
    "marginTop" REAL NOT NULL DEFAULT 15,
    "marginBottom" REAL NOT NULL DEFAULT 15,
    "marginLeft" REAL NOT NULL DEFAULT 10,
    "marginRight" REAL NOT NULL DEFAULT 10,
    "colWidthMajorNumber" REAL NOT NULL DEFAULT 10,
    "colWidthSubNumber" REAL NOT NULL DEFAULT 10,
    "colWidthBranchNumber" REAL NOT NULL DEFAULT 10,
    "majorQuestionSpacing" REAL NOT NULL DEFAULT 5,
    "headerHeight" REAL NOT NULL DEFAULT 0,
    "borderOuterBorder" TEXT NOT NULL DEFAULT 'solid',
    "borderMajorDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderSubDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderBranchDivider" TEXT NOT NULL DEFAULT 'dashed',
    "borderMajorNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderSubNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderBranchNumberDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderOuterBorderWidth" REAL DEFAULT 0.7,
    "borderMajorDividerWidth" REAL DEFAULT 0.5,
    "borderSubDividerWidth" REAL DEFAULT 0.4,
    "borderBranchDividerWidth" REAL DEFAULT 0.3,
    "borderMajorNumberDividerWidth" REAL DEFAULT 0.4,
    "borderSubNumberDividerWidth" REAL DEFAULT 0.4,
    "borderBranchNumberDividerWidth" REAL DEFAULT 0.3,
    "borderManuscriptCharDivider" TEXT NOT NULL DEFAULT 'dashed',
    "borderManuscriptLineDivider" TEXT NOT NULL DEFAULT 'solid',
    "borderManuscriptCharDividerWidth" REAL DEFAULT 0.2,
    "borderManuscriptLineDividerWidth" REAL DEFAULT 0.2,
    "omrMarkersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "omrMarkersSizeMm" REAL NOT NULL DEFAULT 5,
    "omrMarkersOffsetMm" REAL NOT NULL DEFAULT 3,
    "fontFamily" TEXT NOT NULL DEFAULT 'Noto Sans JP',
    "fontDefaultSize" REAL NOT NULL DEFAULT 6,
    "fontMajorNumberSize" REAL NOT NULL DEFAULT 6,
    "fontSubNumberSize" REAL NOT NULL DEFAULT 6,
    "fontBranchNumberSize" REAL NOT NULL DEFAULT 5,
    "multiColumnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "multiColumnCount" INTEGER NOT NULL DEFAULT 2,
    "multiColumnGapMm" REAL NOT NULL DEFAULT 5,
    "multiColumnDividerLine" TEXT,
    "multiColumnDividerLineWidth" REAL NOT NULL DEFAULT 0.3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AsbDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AsbDefinition" ("baseRowHeight", "borderBranchDivider", "borderBranchDividerWidth", "borderBranchNumberDivider", "borderBranchNumberDividerWidth", "borderMajorDivider", "borderMajorDividerWidth", "borderMajorNumberDivider", "borderMajorNumberDividerWidth", "borderOuterBorder", "borderOuterBorderWidth", "borderSubDivider", "borderSubDividerWidth", "borderSubNumberDivider", "borderSubNumberDividerWidth", "colWidthBranchNumber", "colWidthMajorNumber", "colWidthSubNumber", "createdAt", "fontBranchNumberSize", "fontDefaultSize", "fontFamily", "fontMajorNumberSize", "fontSubNumberSize", "headerHeight", "id", "labelPresetBranch", "labelPresetMajor", "labelPresetSub", "majorQuestionSpacing", "marginBottom", "marginLeft", "marginRight", "marginTop", "multiColumnCount", "multiColumnDividerLine", "multiColumnDividerLineWidth", "multiColumnEnabled", "multiColumnGapMm", "name", "numberDisplayMode", "omrMarkersEnabled", "omrMarkersOffsetMm", "omrMarkersSizeMm", "orientation", "paperSize", "renderMode", "updatedAt", "userId", "verticalLayout") SELECT "baseRowHeight", "borderBranchDivider", "borderBranchDividerWidth", "borderBranchNumberDivider", "borderBranchNumberDividerWidth", "borderMajorDivider", "borderMajorDividerWidth", "borderMajorNumberDivider", "borderMajorNumberDividerWidth", "borderOuterBorder", "borderOuterBorderWidth", "borderSubDivider", "borderSubDividerWidth", "borderSubNumberDivider", "borderSubNumberDividerWidth", "colWidthBranchNumber", "colWidthMajorNumber", "colWidthSubNumber", "createdAt", "fontBranchNumberSize", "fontDefaultSize", "fontFamily", "fontMajorNumberSize", "fontSubNumberSize", "headerHeight", "id", "labelPresetBranch", "labelPresetMajor", "labelPresetSub", "majorQuestionSpacing", "marginBottom", "marginLeft", "marginRight", "marginTop", "multiColumnCount", "multiColumnDividerLine", "multiColumnDividerLineWidth", "multiColumnEnabled", "multiColumnGapMm", "name", "numberDisplayMode", "omrMarkersEnabled", "omrMarkersOffsetMm", "omrMarkersSizeMm", "orientation", "paperSize", "renderMode", "updatedAt", "userId", "verticalLayout" FROM "AsbDefinition";
DROP TABLE "AsbDefinition";
ALTER TABLE "new_AsbDefinition" RENAME TO "AsbDefinition";
CREATE INDEX "AsbDefinition_userId_idx" ON "AsbDefinition"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
