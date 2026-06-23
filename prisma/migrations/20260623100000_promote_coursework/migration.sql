-- 試験外成績資料（Coursework）をトップレベル実体へ昇格する。
-- 既存の manual 型 GradeDataSource（点数・文字評価・変換表を内包）を
-- Coursework / CourseworkItem / CourseworkScore / CourseworkLetterScale / 名簿 / 学級 へ移送し、
-- GradeDataSource は courseworkItemId で評価項目を参照する形（type='coursework'）に置き換える。
-- id は前置詞で決定的に生成（pure-SQL で完結）。新規行のタイムスタンプは元行から引き継ぐ。

-- CreateTable: 試験外成績資料
CREATE TABLE "Coursework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable: 試験外成績資料の対象学級
CREATE TABLE "CourseworkClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkClass_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable: 試験外成績資料の対象生徒（名簿）
CREATE TABLE "CourseworkStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkStudent_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable: 試験外成績資料のタグ
CREATE TABLE "CourseworkTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkTag_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable: 評価項目
CREATE TABLE "CourseworkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maxScore" DECIMAL NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'numeric',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkItem_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable: 生徒×評価項目の点数
CREATE TABLE "CourseworkScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkItemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DECIMAL,
    "letterValue" TEXT,
    "adjustment" DECIMAL DEFAULT 0,
    "adjustmentReason" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkScore_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CourseworkScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable: 文字評価→点数の変換表
CREATE TABLE "CourseworkLetterScale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseworkItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseworkLetterScale_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX "CourseworkClass_courseworkId_idx" ON "CourseworkClass"("courseworkId");
CREATE INDEX "CourseworkClass_classId_idx" ON "CourseworkClass"("classId");
CREATE UNIQUE INDEX "CourseworkClass_courseworkId_classId_key" ON "CourseworkClass"("courseworkId", "classId");
CREATE INDEX "CourseworkStudent_courseworkId_idx" ON "CourseworkStudent"("courseworkId");
CREATE INDEX "CourseworkStudent_studentId_idx" ON "CourseworkStudent"("studentId");
CREATE INDEX "CourseworkStudent_courseworkId_customOrder_idx" ON "CourseworkStudent"("courseworkId", "customOrder");
CREATE UNIQUE INDEX "CourseworkStudent_courseworkId_studentId_key" ON "CourseworkStudent"("courseworkId", "studentId");
CREATE INDEX "CourseworkTag_courseworkId_idx" ON "CourseworkTag"("courseworkId");
CREATE INDEX "CourseworkTag_tagId_idx" ON "CourseworkTag"("tagId");
CREATE UNIQUE INDEX "CourseworkTag_courseworkId_tagId_key" ON "CourseworkTag"("courseworkId", "tagId");
CREATE INDEX "CourseworkItem_courseworkId_idx" ON "CourseworkItem"("courseworkId");
CREATE INDEX "CourseworkScore_courseworkItemId_idx" ON "CourseworkScore"("courseworkItemId");
CREATE INDEX "CourseworkScore_studentId_idx" ON "CourseworkScore"("studentId");
CREATE UNIQUE INDEX "CourseworkScore_courseworkItemId_studentId_key" ON "CourseworkScore"("courseworkItemId", "studentId");
CREATE INDEX "CourseworkLetterScale_courseworkItemId_idx" ON "CourseworkLetterScale"("courseworkItemId");
CREATE UNIQUE INDEX "CourseworkLetterScale_courseworkItemId_label_key" ON "CourseworkLetterScale"("courseworkItemId", "label");

-- AlterTable: GradeDataSource に評価項目参照を追加
ALTER TABLE "GradeDataSource" ADD COLUMN "courseworkItemId" TEXT;
CREATE INDEX "GradeDataSource_courseworkItemId_idx" ON "GradeDataSource"("courseworkItemId");

-- DataMigration: manual 型 GradeDataSource → Coursework（1データソース=1資料=1評価項目）
INSERT INTO "Coursework" ("id", "name", "description", "date", "createdAt", "updatedAt")
SELECT 'cw-' || gds."id", gds."name", NULL, NULL, gds."createdAt", gds."updatedAt"
FROM "GradeDataSource" gds
WHERE gds."type" = 'manual';

-- DataMigration: 評価項目（id は元の GradeDataSource.id を流用）
INSERT INTO "CourseworkItem" ("id", "courseworkId", "name", "order", "maxScore", "inputMode", "createdAt", "updatedAt")
SELECT gds."id", 'cw-' || gds."id", gds."name", 0, gds."maxScore", gds."inputMode", gds."createdAt", gds."updatedAt"
FROM "GradeDataSource" gds
WHERE gds."type" = 'manual';

-- DataMigration: 対象学級（所属 Grade の GradeClass を複製。id に gds.id を含めて衝突回避）
INSERT INTO "CourseworkClass" ("id", "courseworkId", "classId", "order", "createdAt", "updatedAt")
SELECT 'cwc-' || gds."id" || '-' || gc."id", 'cw-' || gds."id", gc."classId", gc."order", gc."createdAt", gc."updatedAt"
FROM "GradeDataSource" gds
JOIN "GradeItem" gi ON gi."id" = gds."gradeItemId"
JOIN "GradeClass" gc ON gc."gradeId" = gi."gradeId"
WHERE gds."type" = 'manual';

-- DataMigration: 名簿（所属 Grade の全 GradeStudent を複製。点数未入力の生徒も保護）
INSERT INTO "CourseworkStudent" ("id", "courseworkId", "studentId", "customOrder", "createdAt", "updatedAt")
SELECT 'cws-' || gds."id" || '-' || gst."id", 'cw-' || gds."id", gst."studentId", gst."customOrder", gst."createdAt", gst."updatedAt"
FROM "GradeDataSource" gds
JOIN "GradeItem" gi ON gi."id" = gds."gradeItemId"
JOIN "GradeStudent" gst ON gst."gradeId" = gi."gradeId"
WHERE gds."type" = 'manual';

-- DataMigration: 点数（ManualScore の id を流用して評価項目へ移送）
INSERT INTO "CourseworkScore" ("id", "courseworkItemId", "studentId", "score", "letterValue", "adjustment", "adjustmentReason", "comment", "createdAt", "updatedAt")
SELECT ms."id", ms."gradeDataSourceId", ms."studentId", ms."score", ms."letterValue", ms."adjustment", ms."adjustmentReason", ms."comment", ms."createdAt", ms."updatedAt"
FROM "ManualScore" ms
JOIN "GradeDataSource" gds ON gds."id" = ms."gradeDataSourceId"
WHERE gds."type" = 'manual';

-- DataMigration: 変換表（GradeLetterScale の id を流用して評価項目へ移送）
INSERT INTO "CourseworkLetterScale" ("id", "courseworkItemId", "label", "score", "order", "createdAt", "updatedAt")
SELECT gls."id", gls."gradeDataSourceId", gls."label", gls."score", gls."order", gls."createdAt", gls."updatedAt"
FROM "GradeLetterScale" gls
JOIN "GradeDataSource" gds ON gds."id" = gls."gradeDataSourceId"
WHERE gds."type" = 'manual';

-- DataMigration: GradeDataSource を coursework 参照へ置き換え
UPDATE "GradeDataSource"
SET "courseworkItemId" = "id", "type" = 'coursework'
WHERE "type" = 'manual';

-- Cleanup: 旧テーブル・旧列を撤去
DROP TABLE "ManualScore";
DROP TABLE "GradeLetterScale";
ALTER TABLE "GradeDataSource" DROP COLUMN "inputMode";
