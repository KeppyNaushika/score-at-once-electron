/**
 * 個人成績通知書の設定。
 *
 * **形は DB の行そのもの**（`GradeIndividualReportSettings`）。画面は行を受け取り、
 * 変えた列だけを書く。かつては設定をまるごと JSON 文字列で持ち、画面用に別の入れ子の
 * 形を手で書いていたが、それだと続けて2つチェックを入れたときに先の1つが消えた
 * （塊で読み書きするため）。
 */

import type { GradeIndividualReportSettings } from "@prisma/client"

/** 設定の中身（`id` / `gradeId` / 日時を除いた列） */
export type GradeReportSettings = Omit<
  GradeIndividualReportSettings,
  "id" | "gradeId" | "createdAt" | "updatedAt"
>

/**
 * まだ設定していないときの姿。
 *
 * **`schema.prisma` の `@default` と一致させること。** 行が無いうちは画面がこれで描き、
 * 最初の書き込みで作られる行は DB の既定で埋まるので、食い違うと「触っていない項目が
 * 保存した瞬間に変わる」。`__tests__/grade/gradeReportSettings.test.ts` が突き合わせる。
 */
export const DEFAULT_GRADE_REPORT_SETTINGS: GradeReportSettings = {
  title: "個人成績通知書",

  showItemGrades: true,
  itemGradeColumnScore: true,
  itemGradeColumnPercentage: true,
  itemGradeColumnGradeLabel: true,
  itemGradeFontSize: 11,
  itemGradeTableColumns: 1,

  showSourceBreakdown: false,
  sourceBreakdownColumnScore: true,
  sourceBreakdownColumnWeight: true,
  sourceBreakdownColumnComment: false,
  sourceBreakdownFontSize: 11,
  sourceBreakdownTableColumns: 1,

  dataSourceLabel: "",

  showCommentSection: false,
  showSignatureSection: false,

  footerLeft: "",
  footerCenter: "",
  footerRight: "",
}
