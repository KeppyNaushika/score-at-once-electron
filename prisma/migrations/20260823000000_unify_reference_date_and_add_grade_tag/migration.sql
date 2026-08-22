-- 「その実体がいつのものか」を表す日付の名前を referenceDate に揃え、成績にもタグを持たせる。
--
-- 日付は試験 examDate / 資料 date / 成績 referenceDate の3つが同じ役割（在籍判定の基準日）
-- なのに別々の名前で、解答用紙には無かった。4画面の一覧が同じ列を同じ意味で持てるよう、
-- DB の名前を referenceDate 1つに揃え、解答用紙にも足す（表示の語は実体ごとのまま）。
--
-- 列のリネームなのでテーブルの作り直しは要らない。examDate も date も FK でも FK 参照先でも
-- ないため dangling は生じず、RENAME TO を含まないので子テーブルの外部キーが旧名を指したまま
-- 残る問題も起きない（migrationDeployer は非トランザクション・FK 既定 OFF で適用する）。
ALTER TABLE "Exam" RENAME COLUMN "examDate" TO "referenceDate";

ALTER TABLE "Coursework" RENAME COLUMN "date" TO "referenceDate";

-- 解答用紙は名簿を持たないので在籍判定には使われない（「いつ使う用紙か」を示すだけ）。
-- 他の3つと同じく nullable。
ALTER TABLE "AsbDefinition" ADD COLUMN "referenceDate" DATETIME;

-- 説明を持っていたのは Exam / Coursework / Grade の3つだけだった。4つの概要ページを
-- 同じ項目（名前・日付・説明・タグ）で揃えるので解答用紙にも足す。
-- 既存3つと同じ宣言（Prisma で String? ＝ TEXT の nullable・既定値なし）。
ALTER TABLE "AsbDefinition" ADD COLUMN "description" TEXT;

-- タグの中間テーブルは ExamTag / CourseworkTag / AsbDefinitionTag / TagSubtotalGroup の4つで、
-- 成績だけが持っていなかった。列・カスケード・索引は既存3つと同じ形にしてある。
CREATE TABLE "GradeTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeTag_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GradeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "GradeTag_gradeId_tagId_key" ON "GradeTag"("gradeId", "tagId");

CREATE INDEX "GradeTag_gradeId_idx" ON "GradeTag"("gradeId");

CREATE INDEX "GradeTag_tagId_idx" ON "GradeTag"("tagId");
