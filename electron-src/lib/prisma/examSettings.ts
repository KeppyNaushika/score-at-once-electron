/**
 * 試験の出力設定のPrisma操作。
 *
 * DB は行で持つ（重ね描きのスタイルは種別ごと、可視性は採点状態ごと、
 * 個人成績表は設定・表の節・グラフの3テーブル）。renderer は種別・状態で
 * 引きたいので、境界であるここが行 ⇄ 束ねた形の変換を担う。
 */

import type {
  ExamIndividualReportGraphSettings,
  ExamIndividualReportTableSection,
} from "@prisma/client"

import { examWithExportSettingsInclude } from "../../../src/types/prismaExtensions"
import type {
  AnswerOverlaySettings,
  AnswerOverlayStyle,
  AnswerOverlayVisibility,
} from "../../../src/types/scoringOverlay.types"
import {
  DEFAULT_ANSWER_OVERLAY_SETTINGS,
  toAnswerOverlaySettings,
} from "../../../src/types/scoringOverlay.types"
import type { IndividualReportOptions } from "../export/individual-report/types"
import type {
  StatisticKind,
  StatisticScope,
  StatisticVisibility,
} from "../export/individual-report/types"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  STATISTIC_KINDS,
  toReportDisplayMode,
  toReportPageLayout,
  toReportPageOrientation,
  toStatisticKind,
  toStatisticScope,
  toTableColumns,
} from "../export/individual-report/types"
import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"

/** 試験の出力設定一式（IPC で renderer へ渡す形） */
export interface ExamExportSettings {
  answerOverlay: AnswerOverlaySettings
  individualReport: IndividualReportOptions
}

/** 試験の出力設定を取得する（未設定の項目は既定値で補う） */
export async function getExamExportSettings(
  examId: string
): Promise<ExamExportSettings> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: examWithExportSettingsInclude,
  })

  const styleRows = exam?.answerOverlayStyles ?? []
  const visibilityRows = exam?.answerOverlayVisibilities ?? []
  const reportRow = exam?.individualReportSettings ?? null
  const sectionRows = exam?.individualReportTableSections ?? []
  const graphRow = exam?.individualReportGraphSettings ?? null
  const statisticRows = exam?.individualReportStatisticVisibilities ?? []

  const subtotalSection = sectionRows.find(
    (section) => section.tableKind === "subtotal"
  )
  const questionSection = sectionRows.find(
    (section) => section.tableKind === "question"
  )
  const defaults = DEFAULT_INDIVIDUAL_REPORT_OPTIONS

  return {
    answerOverlay: toAnswerOverlaySettings(
      styleRows,
      visibilityRows,
      DEFAULT_ANSWER_OVERLAY_SETTINGS
    ),
    individualReport: {
      ...defaults,
      ...(reportRow
        ? {
            displayMode: toReportDisplayMode(reportRow.displayMode),
            showScore: reportRow.showScore,
            showMarks: reportRow.showMarks,

            hideUnassignedSubtotals: reportRow.hideUnassignedSubtotals,
            showGroupSubtotals: reportRow.showGroupSubtotals,
            showCorrectRate: reportRow.showCorrectRate,
            showScoreRate: reportRow.showScoreRate,
            showLearningAdvice: reportRow.showLearningAdvice,
            adviceOptions: {
              reviewRateMin: reportRow.adviceReviewRateMin,
              reviewRateMax: reportRow.adviceReviewRateMax,
              reviewQuestionCount: reportRow.adviceReviewQuestionCount,
            },
            showComment: reportRow.showComment,
            showSignature: reportRow.showSignature,
            pageLayout: toReportPageLayout(reportRow.pageLayout),
            pageOrientation: toReportPageOrientation(reportRow.pageOrientation),
            tableSubtotalGroupSelection: {
              enabled: reportRow.tableGroupSelectionEnabled,
              selectedGroupIds: [],
            },

            boxPlotIncludeStatuses: {
              participating: reportRow.statisticsIncludesParticipating,
              expected: reportRow.statisticsIncludesExpected,
              absent: reportRow.statisticsIncludesAbsent,
            },
          }
        : {}),
      ...(subtotalSection
        ? {
            showSubtotalTable: subtotalSection.enabled,
            subtotalTableColumns: toTableColumns(subtotalSection.columns),
            subtotalTableFontSize: subtotalSection.fontSize,
          }
        : {}),
      ...(questionSection
        ? {
            showQuestionTable: questionSection.enabled,
            questionTableColumns: toTableColumns(questionSection.columns),
            questionTableFontSize: questionSection.fontSize,
          }
        : {}),
      statistics: buildStatisticVisibility(statisticRows),
      boxPlotSubtotalGroupSelection: {
        enabled: graphRow?.boxPlotGroupSelectionEnabled ?? false,
        selectedGroupIds: [],
      },
      graphOptions: graphRow
        ? {
            showBarChart: graphRow.showBarChart,
            showRadarChart: graphRow.showRadarChart,
            showTotalScoreBoxPlot: graphRow.showTotalScoreBoxPlot,
            showBoxPlotMin: graphRow.showBoxPlotMin,
            showBoxPlotQ1: graphRow.showBoxPlotQ1,
            showBoxPlotMedian: graphRow.showBoxPlotMedian,
            showBoxPlotQ3: graphRow.showBoxPlotQ3,
            showBoxPlotMax: graphRow.showBoxPlotMax,
            showAverageLine: graphRow.showAverageLine,
            showStudentMarker: graphRow.showStudentMarker,
            boxPlotFontSize: graphRow.boxPlotFontSize,
            boxPlotItemHeight: graphRow.boxPlotItemHeight,
          }
        : defaults.graphOptions,
    },
  }
}

/**
 * 出力設定の書き込みは**1つにつき1レコード**。
 *
 * 以前は設定一式を受け取り、6テーブル 20行以上を1つの `$transaction` で
 * upsert していた。打鍵1回でその全部が走るので、共有フォルダ上の SQLite では
 * 書き込みが重くなり、renderer 側はそれを隠すためのデバウンスを抱えていた。
 * 何を変えたかは利用者の操作が知っているので、その1行だけを書く。
 */

/** 行の識別と履歴を除いた、書き込む値だけ */
type RowValues<TRow, TIdentity extends keyof TRow = never> = Omit<
  TRow,
  "id" | "examId" | "createdAt" | "updatedAt" | TIdentity
>

/** 個人成績表の表の節（小計・設問）1行分の値 */
export type ExamReportTableSectionValues = RowValues<
  ExamIndividualReportTableSection,
  "tableKind"
>

/** 個人成績表のグラフ設定1行分の値 */
export type ExamReportGraphSettingsValues =
  RowValues<ExamIndividualReportGraphSettings>

/**
 * 出力設定を触ったことを監査ログへ残す。
 *
 * 行ごとに書くようになったので1操作が複数行になることもあるが、利用者から見れば
 * 「出力設定を変えた」の1件。`coalesceKey` で1つにまとめる。
 */
async function recordExportSettingsAudit(examId: string): Promise<void> {
  const scope = await resolveExamScope(examId)
  await recordAuditLog({
    action: "exam.export_settings.update",
    entityType: "ExamIndividualReportSettings",
    entityId: examId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    coalesceKey: `export_settings:${examId}`,
  })
}

/**
 * 重ね描きのスタイルを1種別ぶん書く。
 *
 * 値の列は**引き算で決める**（識別と履歴を落とした残り）。列を並べて書き写すと、
 * 列を足したときに永続化から漏れる。
 */
export async function setExamAnswerOverlayStyle(
  examId: string,
  style: AnswerOverlayStyle
): Promise<void> {
  const {
    id: _id,
    examId: _examId,
    overlayKind,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...values
  } = style

  await prisma.examAnswerOverlayStyle.upsert({
    where: { examId_overlayKind: { examId, overlayKind } },
    update: values,
    create: { examId, overlayKind, ...values },
  })
  await recordExportSettingsAudit(examId)
}

/** 採点状態1つぶんの可視性を書く */
export async function setExamAnswerOverlayVisibility(
  examId: string,
  visibility: AnswerOverlayVisibility
): Promise<void> {
  const {
    id: _id,
    examId: _examId,
    status,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...values
  } = visibility

  await prisma.examAnswerOverlayVisibility.upsert({
    where: { examId_status: { examId, status } },
    update: values,
    create: { examId, status, ...values },
  })
  await recordExportSettingsAudit(examId)
}

/**
 * 統計（平均・偏差値・順位・箱ひげ図）の可視性を、種別×母集団の1マスぶん書く。
 *
 * 綴りは読み出しと同じ正規化を通す。renderer は種別の一覧（`STATISTIC_KINDS`）を
 * 値として引けない（`src` から `electron-src` は型のみ）ので文字列で渡ってくる。
 * 想定外の綴りをそのまま行にしない。
 */
export async function setExamReportStatisticVisibility(
  examId: string,
  rawStatisticKind: string,
  rawScope: string,
  shown: boolean
): Promise<void> {
  const statisticKind: StatisticKind = toStatisticKind(rawStatisticKind)
  const scope: StatisticScope = toStatisticScope(rawScope)

  await prisma.examIndividualReportStatisticVisibility.upsert({
    where: { examId_statisticKind_scope: { examId, statisticKind, scope } },
    update: { shown },
    create: { examId, statisticKind, scope, shown },
  })
  await recordExportSettingsAudit(examId)
}

/**
 * 個人成績表の設定本体（1試験に1行）を書く。
 *
 * この行だけは `IndividualReportOptions` の十数個のフィールドから組む。読み出し
 * （`getExamExportSettings`）と対になる射影なので、**両方をこのファイルに置く**。
 * 片方を renderer へ移すとプロセスを跨いで食い違う。
 */
export async function setExamReportSettings(
  examId: string,
  individualReport: IndividualReportOptions
): Promise<void> {
  const values = {
    displayMode: individualReport.displayMode,
    showScore: individualReport.showScore,
    showMarks: individualReport.showMarks,
    hideUnassignedSubtotals: individualReport.hideUnassignedSubtotals,
    showGroupSubtotals: individualReport.showGroupSubtotals,
    showCorrectRate: individualReport.showCorrectRate,
    showScoreRate: individualReport.showScoreRate,
    showLearningAdvice: individualReport.showLearningAdvice,
    adviceReviewRateMin: individualReport.adviceOptions.reviewRateMin,
    adviceReviewRateMax: individualReport.adviceOptions.reviewRateMax,
    adviceReviewQuestionCount:
      individualReport.adviceOptions.reviewQuestionCount,
    showComment: individualReport.showComment,
    showSignature: individualReport.showSignature,
    pageLayout: individualReport.pageLayout,
    pageOrientation: individualReport.pageOrientation,
    tableGroupSelectionEnabled:
      individualReport.tableSubtotalGroupSelection.enabled,
    statisticsIncludesParticipating:
      individualReport.boxPlotIncludeStatuses.participating,
    statisticsIncludesExpected:
      individualReport.boxPlotIncludeStatuses.expected,
    statisticsIncludesAbsent: individualReport.boxPlotIncludeStatuses.absent,
  }

  await prisma.examIndividualReportSettings.upsert({
    where: { examId },
    update: values,
    create: { examId, ...values },
  })
  await recordExportSettingsAudit(examId)
}

/** 個人成績表の表の節（小計・設問）を1つぶん書く */
export async function setExamReportTableSection(
  examId: string,
  tableKind: string,
  values: ExamReportTableSectionValues
): Promise<void> {
  await prisma.examIndividualReportTableSection.upsert({
    where: { examId_tableKind: { examId, tableKind } },
    update: values,
    create: { examId, tableKind, ...values },
  })
  await recordExportSettingsAudit(examId)
}

/** 個人成績表のグラフ設定（1試験に1行）を書く */
export async function setExamReportGraphSettings(
  examId: string,
  values: ExamReportGraphSettingsValues
): Promise<void> {
  await prisma.examIndividualReportGraphSettings.upsert({
    where: { examId },
    update: values,
    create: { examId, ...values },
  })
  await recordExportSettingsAudit(examId)
}

/** 統計の可視性の行を、種別×母集団の表へ組む。欠けは既定値で補う */
function buildStatisticVisibility(
  rows: { statisticKind: string; scope: string; shown: boolean }[]
): StatisticVisibility {
  const visibility = STATISTIC_KINDS.reduce((acc, statisticKind) => {
    acc[statisticKind] = {
      ...DEFAULT_INDIVIDUAL_REPORT_OPTIONS.statistics[statisticKind],
    }
    return acc
  }, {} as StatisticVisibility)

  for (const row of rows) {
    const statisticKind: StatisticKind = toStatisticKind(row.statisticKind)
    const scope: StatisticScope = toStatisticScope(row.scope)
    visibility[statisticKind][scope] = row.shown
  }
  return visibility
}
