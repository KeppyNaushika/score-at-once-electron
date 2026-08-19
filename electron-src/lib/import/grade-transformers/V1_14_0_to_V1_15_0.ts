/**
 * 1.14.0 → 1.15.0: 出力設定の JSON（GradeExportSettings.settingsJson）を列へ割る。
 *
 * 1.14.0 までは個人成績通知書の設定をまるごと JSON 文字列で持っていた
 * （`{"reportOptions": { … }}`）。塊で読み書きすると、続けて2つチェックを入れたときに
 * 先の1つが消える。列へ割ればその競合が無くなる。
 *
 * **読めなかった項目は既定で埋める。** 保存された時点に無かった項目（後から増えたもの）は
 * JSON にも入っていないので、欠落は普通に起こる。
 */

import type {
  ArchiveGradeIndividualReportSettingsRow,
  GradeArchiveVersion,
} from "../../../../src/types/gradeArchive.types"
import { DEFAULT_GRADE_REPORT_SETTINGS } from "../../../../src/types/gradeReport.types"
import type { ArchiveGradeExportSettingsRowV1_14_0 } from "./legacyShape"
import type {
  AnyGradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "./types"
import { isGradeArchiveV1_14_0 } from "./types"

/** 保存されていた JSON の中から、通知書の設定の入れ物を取り出す */
function readReportOptions(settingsJson: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(settingsJson)
  } catch {
    return {}
  }
  if (typeof parsed !== "object" || parsed === null) return {}
  const reportOptions = (parsed as { reportOptions?: unknown }).reportOptions
  if (typeof reportOptions !== "object" || reportOptions === null) return {}
  return { ...reportOptions }
}

/** 入れ子だった項目を1段だけ辿る */
function readNested(
  options: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = options[key]
  if (typeof value !== "object" || value === null) return {}
  return { ...value }
}

function readBoolean(
  values: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const value = values[key]
  return typeof value === "boolean" ? value : fallback
}

function readNumber(
  values: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = values[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function readString(
  values: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = values[key]
  return typeof value === "string" ? value : fallback
}

function toReportSettingsRow(
  exportSettings: ArchiveGradeExportSettingsRowV1_14_0
): ArchiveGradeIndividualReportSettingsRow {
  const options = readReportOptions(exportSettings.settingsJson)
  const itemGradeColumns = readNested(options, "itemGradeColumns")
  const sourceBreakdownColumns = readNested(options, "sourceBreakdownColumns")
  const footer = readNested(options, "footer")
  const defaults = DEFAULT_GRADE_REPORT_SETTINGS

  return {
    id: exportSettings.id,
    gradeId: exportSettings.gradeId,

    title: readString(options, "title", defaults.title),

    showItemGrades: readBoolean(
      options,
      "showItemGrades",
      defaults.showItemGrades
    ),
    itemGradeColumnScore: readBoolean(
      itemGradeColumns,
      "score",
      defaults.itemGradeColumnScore
    ),
    itemGradeColumnPercentage: readBoolean(
      itemGradeColumns,
      "percentage",
      defaults.itemGradeColumnPercentage
    ),
    itemGradeColumnGradeLabel: readBoolean(
      itemGradeColumns,
      "gradeLabel",
      defaults.itemGradeColumnGradeLabel
    ),
    itemGradeFontSize: readNumber(
      options,
      "itemGradeFontSize",
      defaults.itemGradeFontSize
    ),
    itemGradeTableColumns: readNumber(
      options,
      "itemGradeTableColumns",
      defaults.itemGradeTableColumns
    ),

    showSourceBreakdown: readBoolean(
      options,
      "showSourceBreakdown",
      defaults.showSourceBreakdown
    ),
    sourceBreakdownColumnScore: readBoolean(
      sourceBreakdownColumns,
      "score",
      defaults.sourceBreakdownColumnScore
    ),
    sourceBreakdownColumnWeight: readBoolean(
      sourceBreakdownColumns,
      "weight",
      defaults.sourceBreakdownColumnWeight
    ),
    sourceBreakdownColumnComment: readBoolean(
      sourceBreakdownColumns,
      "comment",
      defaults.sourceBreakdownColumnComment
    ),
    sourceBreakdownFontSize: readNumber(
      options,
      "sourceBreakdownFontSize",
      defaults.sourceBreakdownFontSize
    ),
    sourceBreakdownTableColumns: readNumber(
      options,
      "sourceBreakdownTableColumns",
      defaults.sourceBreakdownTableColumns
    ),

    dataSourceLabel: readString(
      options,
      "dataSourceLabel",
      defaults.dataSourceLabel
    ),

    showCommentSection: readBoolean(
      options,
      "showCommentSection",
      defaults.showCommentSection
    ),
    showSignatureSection: readBoolean(
      options,
      "showSignatureSection",
      defaults.showSignatureSection
    ),

    footerLeft: readString(footer, "left", defaults.footerLeft),
    footerCenter: readString(footer, "center", defaults.footerCenter),
    footerRight: readString(footer, "right", defaults.footerRight),

    createdAt: exportSettings.createdAt,
    updatedAt: exportSettings.updatedAt,
  }
}

export class V1_14_0_to_V1_15_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.14.0"
  readonly toVersion: GradeArchiveVersion = "1.15.0"

  transform(data: AnyGradeArchiveData): GradeTransformResult {
    if (!isGradeArchiveV1_14_0(data)) {
      return { data, warnings: [] }
    }

    const { gradeExportSettings, ...withoutExportSettings } = data
    const warnings: string[] =
      gradeExportSettings.length > 0
        ? [
            "1.14.0→1.15.0: 出力設定を列へ移しました（通知書の設定以外が保存されていた場合、それは失われます）",
          ]
        : []

    return {
      data: {
        ...withoutExportSettings,
        manifest: { ...data.manifest, version: this.toVersion },
        gradeIndividualReportSettings:
          gradeExportSettings.map(toReportSettingsRow),
      },
      warnings,
    }
  }
}
