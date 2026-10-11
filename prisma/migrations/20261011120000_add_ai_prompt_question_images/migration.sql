-- AI 採点のプロンプトに、問題の画像を何枚でも付けられるようにする
-- （docs/vlm-grading-design.md §3-1・§5-3）。
--
--   AiPromptQuestionImage   プロンプトの問題の画像（data ディレクトリからの相対パス）と送る順
--
-- 表を足すだけ。旧 AiPrompt.questionImagePath（1枚）に値がある行は、新しい表へ1行（sortOrder 0）
-- として写す。id は uuidv4 を乱数で作る（20260821000000 と同じ式）。時刻は元のプロンプトの行を写す。
-- 旧列は消さない（列の削除は別の判断）。アプリはもう旧列を読み書きしない。
-- 一意制約は置かない（sqlite-nas-sync の制約）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。

-- CreateTable
CREATE TABLE "AiPromptQuestionImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiPromptQuestionImage_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiPromptQuestionImage_promptId_idx" ON "AiPromptQuestionImage"("promptId");

-- 旧列の画像を写す
INSERT INTO "AiPromptQuestionImage" ("id", "promptId", "imagePath", "sortOrder", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    p."id",
    p."questionImagePath",
    0,
    p."createdAt",
    p."updatedAt"
FROM "AiPrompt" p
WHERE p."questionImagePath" IS NOT NULL AND p."questionImagePath" <> '';
