-- 成績算出の結果に並べて見る「比較」を置く表を作る。
--
-- この成績算出の評価項目（gradeItemId）に、任意の成績算出（自分自身も可）の評価項目
-- （comparedGradeItemId）を対応付ける。1つの項目にいくつでも付けられる。
-- どちらの項目が消えても比較は意味を失うので、両方ともカスケードで消す。
--
-- 同じ組の二重登録は画面で防ぐ。UNIQUE は付けない（別端末で同時に同じ組を足すと、
-- 同期で別id・同一キーの行がぶつかる）。
CREATE TABLE "GradeComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "comparedGradeItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeComparison_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeComparison_comparedGradeItemId_fkey" FOREIGN KEY ("comparedGradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GradeComparison_gradeItemId_idx" ON "GradeComparison"("gradeItemId");

CREATE INDEX "GradeComparison_comparedGradeItemId_idx" ON "GradeComparison"("comparedGradeItemId");
