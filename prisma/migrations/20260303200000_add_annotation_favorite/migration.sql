-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DrawingAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionScoreId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "strokeWidth" INTEGER NOT NULL DEFAULT 3,
    "width" REAL NOT NULL DEFAULT 0.0,
    "height" REAL NOT NULL DEFAULT 0.0,
    "endX" REAL NOT NULL DEFAULT 0.0,
    "endY" REAL NOT NULL DEFAULT 0.0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "text" TEXT NOT NULL DEFAULT '',
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "textBoxWidth" REAL NOT NULL DEFAULT 0.0,
    "textBoxHeight" REAL NOT NULL DEFAULT 0.0,
    "horizontalAlign" TEXT NOT NULL DEFAULT 'left',
    "verticalAlign" TEXT NOT NULL DEFAULT 'top',
    "anchorDirection" TEXT NOT NULL DEFAULT 'top-left',
    "displayX" REAL NOT NULL DEFAULT 0.0,
    "displayY" REAL NOT NULL DEFAULT 0.0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DrawingAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DrawingAnnotation" ("anchorDirection", "color", "createdAt", "displayX", "displayY", "endX", "endY", "fontSize", "height", "horizontalAlign", "id", "lineStyle", "questionScoreId", "strokeWidth", "text", "textBoxHeight", "textBoxWidth", "type", "updatedAt", "userId", "verticalAlign", "width", "x", "y") SELECT "anchorDirection", "color", "createdAt", "displayX", "displayY", "endX", "endY", "fontSize", "height", "horizontalAlign", "id", "lineStyle", "questionScoreId", "strokeWidth", "text", "textBoxHeight", "textBoxWidth", "type", "updatedAt", "userId", "verticalAlign", "width", "x", "y" FROM "DrawingAnnotation";
DROP TABLE "DrawingAnnotation";
ALTER TABLE "new_DrawingAnnotation" RENAME TO "DrawingAnnotation";
CREATE INDEX "DrawingAnnotation_questionScoreId_idx" ON "DrawingAnnotation"("questionScoreId");
CREATE INDEX "DrawingAnnotation_type_idx" ON "DrawingAnnotation"("type");
CREATE INDEX "DrawingAnnotation_createdAt_idx" ON "DrawingAnnotation"("createdAt");
CREATE INDEX "DrawingAnnotation_isFavorite_idx" ON "DrawingAnnotation"("isFavorite");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
