-- 成績の出力設定（GradeExportSettings.settingsJson）を列へ割る。
--
-- 中身は個人成績通知書の設定 1組だけで、`{"reportOptions": { … }}` という形の JSON を
-- まるごと1列に入れていた。塊で読み書きすると、**続けて2つチェックを入れたときに先の1つが
-- 消える**（取り直しが着地する前に、古い写しへ2度目を重ねて書くため）。列にすれば、触った
-- 列だけを書ける。試験側の出力設定（20260731000200）と同じ形にする。
--
-- 既定値は schema.prisma の `@default` と、画面が使う DEFAULT_GRADE_REPORT_SETTINGS に
-- 一致させてある（__tests__/grade/gradeReportSettings.test.ts が突き合わせる）。旧データに
-- 無い項目（後から増えたもの）は、その既定へ落ちる。
--
-- **id は旧行のものをそのまま引き継ぐ。** 各端末がこの移行を独立に走らせても同じ id に
-- なるので、`@@unique` 違反の収束（LWW）を待つ必要がない。日時も引き継ぐ（設定をいつ
-- 決めたかは移行で変わるものではない）。
--
-- 通知書の設定以外が settingsJson に入っていた場合、それはここで失われる。実際に読んで
-- いたのは reportOptions だけで、他のキーを書く経路は無い。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. テーブル作成 ─────────────────────────────────────────────
CREATE TABLE "GradeIndividualReportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '個人成績通知書',
    "showItemGrades" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeColumnScore" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeColumnPercentage" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeColumnGradeLabel" BOOLEAN NOT NULL DEFAULT true,
    "itemGradeFontSize" INTEGER NOT NULL DEFAULT 11,
    "itemGradeTableColumns" INTEGER NOT NULL DEFAULT 1,
    "showSourceBreakdown" BOOLEAN NOT NULL DEFAULT false,
    "sourceBreakdownColumnScore" BOOLEAN NOT NULL DEFAULT true,
    "sourceBreakdownColumnWeight" BOOLEAN NOT NULL DEFAULT true,
    "sourceBreakdownColumnComment" BOOLEAN NOT NULL DEFAULT false,
    "sourceBreakdownFontSize" INTEGER NOT NULL DEFAULT 11,
    "sourceBreakdownTableColumns" INTEGER NOT NULL DEFAULT 1,
    "dataSourceLabel" TEXT NOT NULL DEFAULT '',
    "showCommentSection" BOOLEAN NOT NULL DEFAULT false,
    "showSignatureSection" BOOLEAN NOT NULL DEFAULT false,
    "footerLeft" TEXT NOT NULL DEFAULT '',
    "footerCenter" TEXT NOT NULL DEFAULT '',
    "footerRight" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeIndividualReportSettings_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "GradeIndividualReportSettings_gradeId_key" ON "GradeIndividualReportSettings"("gradeId");

-- ── 2. 設定を移す ───────────────────────────────────────────────
-- 壊れた JSON の行は落とす（読めない設定は既定と区別できない）
INSERT INTO "GradeIndividualReportSettings" (
    "id", "gradeId", "title",
    "showItemGrades",
    "itemGradeColumnScore", "itemGradeColumnPercentage", "itemGradeColumnGradeLabel",
    "itemGradeFontSize", "itemGradeTableColumns",
    "showSourceBreakdown",
    "sourceBreakdownColumnScore", "sourceBreakdownColumnWeight", "sourceBreakdownColumnComment",
    "sourceBreakdownFontSize", "sourceBreakdownTableColumns",
    "dataSourceLabel",
    "showCommentSection", "showSignatureSection",
    "footerLeft", "footerCenter", "footerRight",
    "createdAt", "updatedAt"
)
SELECT
    "id",
    "gradeId",
    COALESCE(json_extract("settingsJson", '$.reportOptions.title'), '個人成績通知書'),
    COALESCE(json_extract("settingsJson", '$.reportOptions.showItemGrades'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.itemGradeColumns.score'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.itemGradeColumns.percentage'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.itemGradeColumns.gradeLabel'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.itemGradeFontSize'), 11),
    COALESCE(json_extract("settingsJson", '$.reportOptions.itemGradeTableColumns'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.showSourceBreakdown'), 0),
    COALESCE(json_extract("settingsJson", '$.reportOptions.sourceBreakdownColumns.score'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.sourceBreakdownColumns.weight'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.sourceBreakdownColumns.comment'), 0),
    COALESCE(json_extract("settingsJson", '$.reportOptions.sourceBreakdownFontSize'), 11),
    COALESCE(json_extract("settingsJson", '$.reportOptions.sourceBreakdownTableColumns'), 1),
    COALESCE(json_extract("settingsJson", '$.reportOptions.dataSourceLabel'), ''),
    COALESCE(json_extract("settingsJson", '$.reportOptions.showCommentSection'), 0),
    COALESCE(json_extract("settingsJson", '$.reportOptions.showSignatureSection'), 0),
    COALESCE(json_extract("settingsJson", '$.reportOptions.footer.left'), ''),
    COALESCE(json_extract("settingsJson", '$.reportOptions.footer.center'), ''),
    COALESCE(json_extract("settingsJson", '$.reportOptions.footer.right'), ''),
    "createdAt",
    "updatedAt"
FROM "GradeExportSettings"
WHERE json_valid("settingsJson");

-- ── 3. 旧テーブルを落とす ───────────────────────────────────────
DROP TABLE "GradeExportSettings";

PRAGMA foreign_keys=ON;
