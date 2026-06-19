-- CreateTable: 答案返却（公式出力）時点の有効スコア＋手書き注釈のスナップショット。
-- 「返却版として記録」操作のたびに生徒×試験ごとに1行を upsert で上書きする
-- （最新の返却版のみ保持）。再印刷時はこれを基準に現在状態との差分を取り、
-- 変更があった生徒だけを絞り込む。
CREATE TABLE "ReturnSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "totalScore" DECIMAL,
    "capturedByUserId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnSnapshot_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ReturnSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnSnapshot_examId_studentId_key" ON "ReturnSnapshot"("examId", "studentId");

-- CreateIndex
CREATE INDEX "ReturnSnapshot_studentId_idx" ON "ReturnSnapshot"("studentId");
