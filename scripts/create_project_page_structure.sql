-- ProjectPageとPageImageテーブルを作成し、AnswerSheetとMasterImageをリファクタリング

-- 1. ProjectPageテーブル作成（ページ管理の中心テーブル）
CREATE TABLE ProjectPage (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. PageImageテーブル作成（画像パス管理）
CREATE TABLE PageImage (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,
    "studentId" TEXT,  -- nullable: nullの場合はマスター画像、値がある場合は生徒の答案画像
    "imagePath" TEXT NOT NULL,
    "imageType" TEXT NOT NULL, -- 'MASTER' or 'ANSWER'
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageImage_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PageImage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. 新しいAnswerSheetテーブル作成（簡素化）
CREATE TABLE AnswerSheet_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectPageId" TEXT NOT NULL,
    "studentId" TEXT,  -- nullable
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerSheet_projectPageId_fkey" FOREIGN KEY ("projectPageId") REFERENCES "ProjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnswerSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- インデックス作成

-- ProjectPage インデックス
CREATE UNIQUE INDEX "ProjectPage_projectId_pageNumber_key" ON "ProjectPage"("projectId", "pageNumber");
CREATE INDEX "ProjectPage_projectId_idx" ON "ProjectPage"("projectId");

-- PageImage 条件付きユニーク制約（SQLite部分インデックス使用）
-- studentId が NULL の場合：projectPageId に対してユニーク（マスター画像）
CREATE UNIQUE INDEX "PageImage_projectPageId_master_key" ON "PageImage"("projectPageId") 
WHERE "studentId" IS NULL;

-- studentId が NOT NULL の場合：projectPageId + studentId に対してユニーク（答案画像）
CREATE UNIQUE INDEX "PageImage_projectPageId_studentId_key" ON "PageImage"("projectPageId", "studentId") 
WHERE "studentId" IS NOT NULL;

CREATE INDEX "PageImage_projectPageId_idx" ON "PageImage"("projectPageId");
CREATE INDEX "PageImage_studentId_idx" ON "PageImage"("studentId");

-- AnswerSheet_new 条件付きユニーク制約
-- studentId が NULL の場合：projectPageId に対してユニーク（マスター用）
CREATE UNIQUE INDEX "AnswerSheet_projectPageId_master_key" ON "AnswerSheet_new"("projectPageId") 
WHERE "studentId" IS NULL;

-- studentId が NOT NULL の場合：projectPageId + studentId に対してユニーク（生徒答案）
CREATE UNIQUE INDEX "AnswerSheet_projectPageId_studentId_key" ON "AnswerSheet_new"("projectPageId", "studentId") 
WHERE "studentId" IS NOT NULL;

CREATE INDEX "AnswerSheet_projectPageId_idx" ON "AnswerSheet_new"("projectPageId");
CREATE INDEX "AnswerSheet_studentId_idx" ON "AnswerSheet_new"("studentId");