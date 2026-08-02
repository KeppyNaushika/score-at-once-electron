-- DrawingAnnotation.userId を落とす。
--
-- QuestionScore は「生徒×設問×採点者」で1行であり、DrawingAnnotation は
-- questionScoreId でその行にぶら下がる。つまり注釈の持ち主は親から一意に決まっていて、
-- 自前の userId は同じ情報の2つ目の置き場だった。
--
-- 冗長そのものより、2箇所に持つと食い違いうることが問題である。親子で採点者が
-- 食い違った注釈は、取得時の採点者絞りから漏れて「自分の注釈が自分に見えない」状態に
-- なる。列がある限り、その状態を作らせない保証はどこにも書けない。
--
-- 移行時点の実データに食い違いは無い（採点者ごとの注釈は必ず自分の QuestionScore に
-- ぶら下がっている）ため、列を落とすだけで情報は失われない。以後、採点者で絞る側は
-- questionScore.userId を辿る。

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
    "strokeWidth" REAL NOT NULL DEFAULT 0.5,
    "width" REAL NOT NULL DEFAULT 0.0,
    "height" REAL NOT NULL DEFAULT 0.0,
    "endX" REAL NOT NULL DEFAULT 0.0,
    "endY" REAL NOT NULL DEFAULT 0.0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "text" TEXT NOT NULL DEFAULT '',
    "fontSize" REAL NOT NULL DEFAULT 4.0,
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
    CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_DrawingAnnotation" ("id", "questionScoreId", "type", "x", "y", "color", "strokeWidth", "width", "height", "endX", "endY", "lineStyle", "text", "fontSize", "textBoxWidth", "textBoxHeight", "horizontalAlign", "verticalAlign", "anchorDirection", "displayX", "displayY", "isFavorite", "createdAt", "updatedAt")
SELECT "id", "questionScoreId", "type", "x", "y", "color", "strokeWidth", "width", "height", "endX", "endY", "lineStyle", "text", "fontSize", "textBoxWidth", "textBoxHeight", "horizontalAlign", "verticalAlign", "anchorDirection", "displayX", "displayY", "isFavorite", "createdAt", "updatedAt"
FROM "DrawingAnnotation";

DROP TABLE "DrawingAnnotation";
ALTER TABLE "new_DrawingAnnotation" RENAME TO "DrawingAnnotation";

CREATE INDEX "DrawingAnnotation_questionScoreId_idx" ON "DrawingAnnotation"("questionScoreId");
CREATE INDEX "DrawingAnnotation_type_idx" ON "DrawingAnnotation"("type");
CREATE INDEX "DrawingAnnotation_createdAt_idx" ON "DrawingAnnotation"("createdAt");
CREATE INDEX "DrawingAnnotation_isFavorite_idx" ON "DrawingAnnotation"("isFavorite");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
