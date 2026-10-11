-- 答案に重ねる要素（採点マーク・設問の点数・小計・合計）の長さを、答案画像の画素から mm へ移す。
--
-- 長さの列（offsetX / offsetY / size）を小数を持てる REAL にし、単位の列 lengthUnit を足す。
-- 既存の行は画素で書かれているので "px" の印を付ける。値はここでは変えない。mm への変換は
-- 答案画像の大きさが要るので、アプリが JS で行う（起動時・統合アーカイブを開いた後・旧アーカイブの
-- 取り込み。electron-src/lib/prisma/answerOverlayLengthConversion.ts）。変換が済んだ行は "mm"。
-- 描画は lengthUnit どおりに換算するので、変換が保留中の "px" の行も見た目は変わらない。
-- 新しく作る行の既定は "mm"。
--
-- 行の id と時刻は変えない（docs/unified-archive-design.md §8 の規約1）。
-- 同期のトリガーは元の表と一緒に消え、次の setupSync が作り直す。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ExamAnswerOverlayStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "overlayKind" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "lengthUnit" TEXT NOT NULL DEFAULT 'mm',
    "offsetX" REAL NOT NULL,
    "offsetY" REAL NOT NULL,
    "size" REAL NOT NULL,
    "color" TEXT NOT NULL,
    "opacity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAnswerOverlayStyle_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExamAnswerOverlayStyle" ("id", "examId", "overlayKind", "position", "anchor", "lengthUnit", "offsetX", "offsetY", "size", "color", "opacity", "createdAt", "updatedAt") SELECT "id", "examId", "overlayKind", "position", "anchor", 'px', "offsetX", "offsetY", "size", "color", "opacity", "createdAt", "updatedAt" FROM "ExamAnswerOverlayStyle";
DROP TABLE "ExamAnswerOverlayStyle";
ALTER TABLE "new_ExamAnswerOverlayStyle" RENAME TO "ExamAnswerOverlayStyle";
CREATE INDEX "ExamAnswerOverlayStyle_examId_idx" ON "ExamAnswerOverlayStyle"("examId");
CREATE UNIQUE INDEX "ExamAnswerOverlayStyle_examId_overlayKind_key" ON "ExamAnswerOverlayStyle"("examId", "overlayKind");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
