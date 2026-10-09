/**
 * 個人成績通知書の設定（GradeIndividualReportSettings）の読み書き。
 *
 * かつては `GradeExportSettings.settingsJson` に設定をまるごと JSON で入れていた。塊で
 * 読み書きすると、**続けて2つチェックを入れたときに先の1つが消える**（取り直しが着地する
 * 前に、古い写しへ2度目を重ねて書くため）。列にすれば、触った列だけを書ける。
 *
 * **既定値は schema.prisma が持つ**（`@default`）。行がまだ無いときに一部だけ書いても、
 * 残りは DB の既定で埋まる。
 */

import type { GradeIndividualReportSettings } from "@prisma/client"

import {
  DEFAULT_GRADE_REPORT_SETTINGS,
  type GradeReportSettings,
} from "../../../src/types/gradeReport.types"
import { diffFields, recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"

/**
 * 操作履歴の変更内容に出す項目名（出力画面の見出しに合わせる）。
 *
 * 列ごとに書くので、列を足すと型がここへの追記を求める（足し忘れると記録から漏れる）。
 */
const REPORT_SETTINGS_FIELD_LABELS: Record<keyof GradeReportSettings, string> =
  {
    title: "タイトル",
    showItemGrades: "項目別評価",
    itemGradeColumnScore: "項目別評価：得点",
    itemGradeColumnPercentage: "項目別評価：得点率",
    itemGradeColumnGradeLabel: "項目別評価：評価",
    itemGradeComparisonMarks: "項目別評価：比較の記号",
    itemGradeFontSize: "項目別評価：文字",
    itemGradeTableColumns: "項目別評価：列数",
    showSourceBreakdown: "資料の内訳",
    sourceBreakdownColumnScore: "資料の内訳：得点",
    sourceBreakdownColumnWeight: "資料の内訳：換算得点",
    sourceBreakdownColumnComment: "資料の内訳：コメント",
    sourceBreakdownFontSize: "資料の内訳：文字",
    sourceBreakdownTableColumns: "資料の内訳：列数",
    dataSourceLabel: "資料の内訳：表示名",
    showCommentSection: "コメント欄",
    showSignatureSection: "押印欄",
    footerLeft: "フッター（左）",
    footerCenter: "フッター（中）",
    footerRight: "フッター（右）",
  }

/** 比べる項目（`diffFields` の形）。項目名の表から作る */
const REPORT_SETTINGS_WATCHED_FIELDS = Object.entries(
  REPORT_SETTINGS_FIELD_LABELS
).map(([field, label]) => ({ field, label }))

/** 設定を引く。まだ無ければ `null`（画面が既定で描く） */
export async function getGradeIndividualReportSettings(
  gradeId: string
): Promise<GradeIndividualReportSettings | null> {
  return prisma.gradeIndividualReportSettings.findUnique({ where: { gradeId } })
}

/**
 * 触った列だけを書く（行がまだ無ければ、残りは DB の既定で作る）。
 *
 * 更新は**触る列だけ**を載せる（`Partial`）。この行にはヌル許容の列が無いので、
 * 「載せていない」と「空にする」が `undefined` で衝突しない。
 */
export async function updateGradeIndividualReportSettings(
  gradeId: string,
  values: Partial<GradeReportSettings>
): Promise<void> {
  const settingsBefore = await prisma.gradeIndividualReportSettings.findUnique({
    where: { gradeId },
  })
  const settingsAfter = await prisma.gradeIndividualReportSettings.upsert({
    where: { gradeId },
    update: values,
    create: { gradeId, ...values },
  })

  await recordReportSettingsAudit(
    gradeId,
    settingsBefore ?? DEFAULT_GRADE_REPORT_SETTINGS,
    settingsAfter
  )
}

/**
 * 設定を触ったことを操作履歴へ残す。変わった項目が無ければ記録しない。
 *
 * 出力画面はチェックを続けて切り替え、文字の欄は打つたびに書く（触った列だけ）ので、
 * **成績算出ごとに1行へまとめる**（`coalesceKey`）。変更内容は項目ごとに
 * 「最初の値 → 最後の値」。行がまだ無かったときの「前」は DB の既定と同じ姿で比べる。
 */
async function recordReportSettingsAudit(
  gradeId: string,
  settingsBefore: GradeReportSettings,
  settingsAfter: GradeReportSettings
): Promise<void> {
  const changes = diffFields<Record<string, unknown>>(
    settingsBefore,
    settingsAfter,
    REPORT_SETTINGS_WATCHED_FIELDS
  )
  if (changes.length === 0) return
  const scope = await resolveGradeScope(gradeId)
  await recordAuditLog({
    action: "grade.report_settings.update",
    entityType: "GradeIndividualReportSettings",
    entityId: gradeId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    changes,
    coalesceKey: `grade_report_settings:${gradeId}`,
  })
}
