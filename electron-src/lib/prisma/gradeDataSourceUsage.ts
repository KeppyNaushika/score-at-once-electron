/**
 * 試験・試験外成績資料とその中の項目が、成績算出（Grade）のデータソースから
 * 使われているかを、**その実体の include として**同梱するための形。
 *
 * 使われているかを調べる専用の問い合わせは持たない。試験・資料・小計点グループの
 * 詳細を取るときに、指しているデータソースを子として一緒に取り、どう使われているかは
 * renderer（と削除の最終判定をする main）が `src/lib/shared/gradeReferenceMessages.ts`
 * で導く。
 *
 * データソースの参照は schema の `onDelete` で黙って変わる（設問・小計は Cascade で
 * データソースごと消え、試験・評価項目・資料は SetNull で参照が空になる）。消した後
 * からは何が起きたか分からないので、**消す前に**ここで取ったものを見る。
 */

import type { Prisma } from "@prisma/client"

/** データソース1件に、評価項目（成績算出・確定値つき）を同梱する */
export const gradeDataSourceUsageInclude = {
  gradeItem: { include: { grade: true, frozenScores: true } },
} satisfies Prisma.GradeDataSourceInclude

/**
 * 試験を使っているデータソース。
 *
 * 試験そのもの（合計点・小計）を指すものと、その試験の設問を指すもの。設問の
 * データソースは examId を冗長に持つが、持たない行があっても設問から辿って拾う。
 * 設問の小計への割り当て（cropSubtotals）は、設問を消すと小計が変わるかを見るのに使う。
 */
export const examGradeUsageInclude = {
  gradeDataSources: { include: gradeDataSourceUsageInclude },
  examPages: {
    include: {
      cropRegions: {
        include: {
          gradeDataSources: { include: gradeDataSourceUsageInclude },
          cropSubtotals: true,
        },
      },
    },
  },
} satisfies Prisma.ExamInclude

/** 試験外成績資料を使っているデータソース（資料合計と、評価項目1つずつ） */
export const courseworkGradeUsageInclude = {
  gradeDataSources: { include: gradeDataSourceUsageInclude },
  items: {
    include: { gradeDataSources: { include: gradeDataSourceUsageInclude } },
  },
} satisfies Prisma.CourseworkInclude

/** 小計点グループの中の小計項目を使っているデータソース */
export const subtotalGroupGradeUsageInclude = {
  subtotals: {
    include: { gradeDataSources: { include: gradeDataSourceUsageInclude } },
  },
} satisfies Prisma.SubtotalGroupInclude

/** 生徒が載っている成績算出の名簿 */
export const studentGradeRosterInclude = {
  gradeStudents: { include: { grade: true } },
} satisfies Prisma.StudentInclude
