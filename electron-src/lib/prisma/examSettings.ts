/**
 * 試験の出力設定のPrisma操作。
 *
 * DB は行で持つ（重ね描きのスタイルは種別ごと、可視性は採点状態ごと、
 * 個人成績表は設定・表の節・グラフの3テーブル）。renderer は種別・状態で
 * 引きたいので、境界であるここが行 ⇄ 束ねた形の変換を担う。
 */

import { examWithExportSettingsInclude } from "../../../src/types/prismaExtensions"
import type {
  AnswerOverlaySettings,
  OverlayKind,
} from "../../../src/types/scoringOverlay.types"
import {
  DEFAULT_ANSWER_OVERLAY_SETTINGS,
  OVERLAY_KINDS,
  toAnswerOverlaySettings,
} from "../../../src/types/scoringOverlay.types"
import { SCORING_STATUSES } from "../../../src/types/scoringStatus.types"
import type { IndividualReportOptions } from "../export/individual-report/types"
import type {
  StatisticKind,
  StatisticScope,
  StatisticVisibility,
} from "../export/individual-report/types"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  STATISTIC_KINDS,
  STATISTIC_SCOPES,
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

/** 試験の出力設定を作成または更新する */
export async function upsertExamExportSettings(
  examId: string,
  settings: ExamExportSettings
): Promise<void> {
  const { answerOverlay, individualReport } = settings

  await prisma.$transaction(async (tx) => {
    for (const overlayKind of OVERLAY_KINDS) {
      const style = answerOverlay.styles[overlayKind]
      const values = {
        position: style.position,
        anchor: style.anchor,
        offsetX: style.offsetX,
        offsetY: style.offsetY,
        size: style.size,
        color: style.color,
        opacity: style.opacity,
      }
      await tx.examAnswerOverlayStyle.upsert({
        where: { examId_overlayKind: { examId, overlayKind } },
        update: values,
        create: {
          examId,
          overlayKind,
          ...values,
        },
      })
    }

    for (const status of SCORING_STATUSES) {
      const visibility = answerOverlay.visibility[status]
      const values = {
        showMark: visibility.showMark,
        showScore: visibility.showScore,
      }
      await tx.examAnswerOverlayVisibility.upsert({
        where: { examId_status: { examId, status } },
        update: values,
        create: {
          examId,
          status,
          ...values,
        },
      })
    }

    for (const statisticKind of STATISTIC_KINDS) {
      for (const scope of STATISTIC_SCOPES) {
        const shown = individualReport.statistics[statisticKind][scope]
        await tx.examIndividualReportStatisticVisibility.upsert({
          where: {
            examId_statisticKind_scope: { examId, statisticKind, scope },
          },
          update: { shown },
          create: {
            examId,
            statisticKind,
            scope,
            shown,
          },
        })
      }
    }

    const reportValues = {
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
    await tx.examIndividualReportSettings.upsert({
      where: { examId },
      update: reportValues,
      create: { id: examId, examId, ...reportValues },
    })

    const sections = [
      {
        tableKind: "subtotal",
        enabled: individualReport.showSubtotalTable,
        columns: individualReport.subtotalTableColumns,
        fontSize: individualReport.subtotalTableFontSize,
      },
      {
        tableKind: "question",
        enabled: individualReport.showQuestionTable,
        columns: individualReport.questionTableColumns,
        fontSize: individualReport.questionTableFontSize,
      },
    ]
    for (const section of sections) {
      const values = {
        enabled: section.enabled,
        columns: section.columns,
        fontSize: section.fontSize,
      }
      await tx.examIndividualReportTableSection.upsert({
        where: {
          examId_tableKind: { examId, tableKind: section.tableKind },
        },
        update: values,
        create: {
          examId,
          tableKind: section.tableKind,
          ...values,
        },
      })
    }

    const graphValues = {
      ...individualReport.graphOptions,
      boxPlotGroupSelectionEnabled:
        individualReport.boxPlotSubtotalGroupSelection.enabled,
    }
    await tx.examIndividualReportGraphSettings.upsert({
      where: { examId },
      update: graphValues,
      create: { id: examId, examId, ...graphValues },
    })
  })

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
