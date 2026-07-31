/**
 * v1.21.0 → v1.22.0 変換器
 *
 * 主な変更点:
 * - ExamMarkingFormat を廃止。記号を文字（symbol）で持つ旧方式は、画像＋配置設定
 *   （ExamExportSettings の scoringMarkConfig）へ置き換わっており、読み書きする UI が
 *   存在しないままアーカイブの入出力経路だけで往復していた。
 * - 手書き数字認識の撤去（#1103）に伴い、OMR設定の numDigits / correctAnswer と
 *   数字枠（CropRegionOmrDigitBox）を廃止。
 *
 * いずれも取り込み先が無くなったので読み捨てる。キーが無い現行形式に対しては無変更で冪等。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/** 廃止されたキーを取り除き、落とした件数を返す */
function dropKey(
  record: Record<string, unknown>,
  key: string
): { dropped: number } {
  const value = record[key]
  const dropped = Array.isArray(value) ? value.length : value ? 1 : 0
  delete record[key]
  return { dropped }
}

export class V1_21_0_to_V1_22_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.21.0"
  readonly toVersion: ExamArchiveVersion = "1.22.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    const examData = {
      ...(data.examData as unknown as Record<string, unknown>),
    }

    const { dropped: droppedFormats } = dropKey(examData, "examMarkingFormats")
    if (droppedFormats > 0) {
      warnings.push(
        `1.21.0→1.22.0: 採点マーク設定（ExamMarkingFormat）は廃止されたため、${droppedFormats}件を読み飛ばしました。採点マークの見た目は出力設定側で管理されます。`
      )
    }

    const { dropped: droppedDigitBoxes } = dropKey(examData, "omrDigitBoxes")
    if (droppedDigitBoxes > 0) {
      warnings.push(
        `1.21.0→1.22.0: OMRの数字枠は廃止されたため、${droppedDigitBoxes}件を読み飛ばしました。`
      )
    }

    // OMR設定から桁数・正答を落とす。選択式以外の設定は取り込み先が無いので除外する
    const omrConfigs = examData.omrConfigs
    if (Array.isArray(omrConfigs)) {
      let droppedConfigs = 0
      examData.omrConfigs = omrConfigs
        .filter((omrConfig) => {
          const isChoice =
            (omrConfig as Record<string, unknown>).type === "choice"
          if (!isChoice) droppedConfigs++
          return isChoice
        })
        .map((omrConfig) => {
          const next = { ...(omrConfig as Record<string, unknown>) }
          delete next.numDigits
          delete next.correctAnswer
          return next
        })
      if (droppedConfigs > 0) {
        warnings.push(
          `1.21.0→1.22.0: 手書き数字認識は廃止されたため、選択式でないOMR設定${droppedConfigs}件を読み飛ばしました（#1103）。`
        )
      }
    }

    expandExportSettings(examData, warnings)

    return {
      data: {
        ...data,
        examData: examData as unknown as ExamArchiveData["examData"],
        manifest: { ...data.manifest, version: this.toVersion },
      },
      warnings,
    }
  }
}

/** JSON から値を1つ取り出す（見つからなければ undefined） */
function readJsonPath(source: unknown, path: string[]): unknown {
  let current = source
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/** 候補を順に見て最初に見つかった値を返す。無ければ既定値 */
function pickValue<T>(source: unknown, candidates: string[][], fallback: T): T {
  for (const path of candidates) {
    const value = readJsonPath(source, path)
    if (value !== undefined && value !== null) return value as T
  }
  return fallback
}

const OVERLAY_STATUS_DEFAULTS: Array<{ status: string; show: boolean }> = [
  { status: "unscored", show: false },
  { status: "correct", show: true },
  { status: "incorrect", show: true },
  { status: "partial", show: true },
  { status: "pending", show: true },
  { status: "no_answer", show: true },
  { status: "double_mark", show: true },
]

/**
 * 旧 examExportSettings（settingsJson）を正規化済みの5セクションへ展開する。
 *
 * anchor は新設なので既存の見た目を保つ値を入れる（マークは position と同値、
 * 点数は中央固定だったため middle-center）。後方互換キー（summaryScore /
 * scorePosition 系）はここでだけ読む。
 */
function expandExportSettings(
  examData: Record<string, unknown>,
  warnings: string[]
): void {
  const legacySettings = examData.examExportSettings
  delete examData.examExportSettings
  if (!legacySettings || typeof legacySettings !== "object") return

  const settingsJson = (legacySettings as Record<string, unknown>).settingsJson
  if (typeof settingsJson !== "string") return

  let parsed: unknown
  try {
    parsed = JSON.parse(settingsJson)
  } catch {
    warnings.push(
      "1.21.0→1.22.0: 出力設定のJSONが壊れていたため、既定値へ戻しました。"
    )
    return
  }

  const examId = String(
    (legacySettings as Record<string, unknown>).examId ?? ""
  )
  const timestamp = String(
    (legacySettings as Record<string, unknown>).createdAt ??
      new Date(0).toISOString()
  )
  const markConfig = readJsonPath(parsed, ["scoringMarkConfig"])
  const reportOptions = readJsonPath(parsed, ["individualReportOptions"])

  const markPosition = pickValue<string>(
    markConfig,
    [["markPosition"]],
    "middle-center"
  )
  const styleSources: Array<{
    overlayKind: string
    position: string
    anchor: string
    offsetX: number
    offsetY: number
    size: number
    color: string
    opacity: number
  }> = [
    {
      overlayKind: "mark",
      position: markPosition,
      anchor: markPosition,
      offsetX: pickValue(markConfig, [["markOffsetX"]], 0),
      offsetY: pickValue(markConfig, [["markOffsetY"]], 0),
      size: pickValue(markConfig, [["markSize"]], 50),
      color: pickValue(markConfig, [["markColor"]], "#ef4444"),
      opacity: pickValue(markConfig, [["markOpacity"]], 100),
    },
    {
      overlayKind: "partial",
      position: pickValue(
        markConfig,
        [["partialScore", "position"], ["scorePosition"]],
        "middle-center"
      ),
      anchor: "middle-center",
      offsetX: pickValue(
        markConfig,
        [["partialScore", "offsetX"], ["scoreOffsetX"]],
        0
      ),
      offsetY: pickValue(
        markConfig,
        [["partialScore", "offsetY"], ["scoreOffsetY"]],
        0
      ),
      size: pickValue(
        markConfig,
        [["partialScore", "size"], ["scoreSize"]],
        14
      ),
      color: pickValue(markConfig, [["partialScore", "color"]], "#ef4444"),
      opacity: pickValue(markConfig, [["partialScore", "opacity"]], 100),
    },
    {
      overlayKind: "subtotal",
      position: pickValue(
        markConfig,
        [
          ["subtotalScore", "position"],
          ["summaryScore", "position"],
        ],
        "middle-center"
      ),
      anchor: "middle-center",
      offsetX: pickValue(
        markConfig,
        [
          ["subtotalScore", "offsetX"],
          ["summaryScore", "offsetX"],
        ],
        0
      ),
      offsetY: pickValue(
        markConfig,
        [
          ["subtotalScore", "offsetY"],
          ["summaryScore", "offsetY"],
        ],
        0
      ),
      size: pickValue(
        markConfig,
        [
          ["subtotalScore", "size"],
          ["summaryScore", "size"],
        ],
        18
      ),
      color: pickValue(
        markConfig,
        [
          ["subtotalScore", "color"],
          ["summaryScore", "color"],
        ],
        "#2563eb"
      ),
      opacity: pickValue(
        markConfig,
        [
          ["subtotalScore", "opacity"],
          ["summaryScore", "opacity"],
        ],
        100
      ),
    },
    {
      overlayKind: "total",
      position: pickValue(
        markConfig,
        [
          ["totalScore", "position"],
          ["summaryScore", "position"],
        ],
        "middle-center"
      ),
      anchor: "middle-center",
      offsetX: pickValue(
        markConfig,
        [
          ["totalScore", "offsetX"],
          ["summaryScore", "offsetX"],
        ],
        0
      ),
      offsetY: pickValue(
        markConfig,
        [
          ["totalScore", "offsetY"],
          ["summaryScore", "offsetY"],
        ],
        0
      ),
      size: pickValue(
        markConfig,
        [
          ["totalScore", "size"],
          ["summaryScore", "size"],
        ],
        18
      ),
      color: pickValue(
        markConfig,
        [
          ["totalScore", "color"],
          ["summaryScore", "color"],
        ],
        "#16a34a"
      ),
      opacity: pickValue(
        markConfig,
        [
          ["totalScore", "opacity"],
          ["summaryScore", "opacity"],
        ],
        100
      ),
    },
  ]

  examData.answerOverlayStyles = styleSources.map((style) => ({
    id: `${examId}:${style.overlayKind}`,
    examId,
    ...style,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))

  examData.answerOverlayVisibilities = OVERLAY_STATUS_DEFAULTS.map(
    ({ status, show }) => ({
      id: `${examId}:${status}`,
      examId,
      status,
      showMark: pickValue(markConfig, [["showMarkForStatus", status]], show),
      showScore: pickValue(markConfig, [["showScoreForStatus", status]], show),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  )

  examData.individualReportSettings = {
    id: examId,
    examId,
    displayMode: pickValue(reportOptions, [["displayMode"]], "detail"),
    showScore: pickValue(reportOptions, [["showScore"]], true),
    showMarks: pickValue(reportOptions, [["showMarks"]], true),
    hideUnassignedSubtotals: pickValue(
      reportOptions,
      [["hideUnassignedSubtotals"]],
      true
    ),
    showGroupSubtotals: pickValue(
      reportOptions,
      [["showGroupSubtotals"]],
      true
    ),
    showCorrectRate: pickValue(reportOptions, [["showCorrectRate"]], true),
    showScoreRate: pickValue(reportOptions, [["showScoreRate"]], false),
    showLearningAdvice: pickValue(
      reportOptions,
      [["showLearningAdvice"]],
      true
    ),
    adviceReviewRateMin: pickValue(
      reportOptions,
      [["adviceOptions", "reviewRateMin"]],
      70
    ),
    adviceReviewRateMax: pickValue<number | null>(
      reportOptions,
      [["adviceOptions", "reviewRateMax"]],
      null
    ),
    adviceReviewQuestionCount: pickValue(
      reportOptions,
      [["adviceOptions", "reviewQuestionCount"]],
      5
    ),
    showComment: pickValue(reportOptions, [["showComment"]], false),
    showSignature: pickValue(reportOptions, [["showSignature"]], false),
    pageLayout: pickValue(reportOptions, [["pageLayout"]], "auto"),
    pageOrientation: pickValue(
      reportOptions,
      [["pageOrientation"]],
      "portrait"
    ),
    tableGroupSelectionEnabled: pickValue(
      reportOptions,
      [["tableSubtotalGroupSelection", "enabled"]],
      false
    ),
    statisticsIncludesParticipating: pickValue(
      reportOptions,
      [["boxPlotIncludeStatuses", "participating"]],
      true
    ),
    statisticsIncludesExpected: pickValue(
      reportOptions,
      [["boxPlotIncludeStatuses", "expected"]],
      true
    ),
    statisticsIncludesAbsent: pickValue(
      reportOptions,
      [["boxPlotIncludeStatuses", "absent"]],
      false
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  examData.individualReportTableSections = [
    {
      id: `${examId}:subtotal`,
      examId,
      tableKind: "subtotal",
      enabled: pickValue(reportOptions, [["showSubtotalTable"]], true),
      columns: pickValue(reportOptions, [["subtotalTableColumns"]], 1),
      fontSize: pickValue(reportOptions, [["subtotalTableFontSize"]], 10),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: `${examId}:question`,
      examId,
      tableKind: "question",
      enabled: pickValue(reportOptions, [["showQuestionTable"]], true),
      columns: pickValue(reportOptions, [["questionTableColumns"]], 1),
      fontSize: pickValue(reportOptions, [["questionTableFontSize"]], 10),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]

  // 統計の可視性: 旧形式は平均を4値文字列、順位を真偽＋3値文字列という別の詰め方で
  // 同じ「所属学級ごと／全体」の2ビットを表していた。両方とも真偽へ展開する。
  // 学級ごとの偏差値・箱ひげ図は旧形式に存在しないので false で始める。
  const legacyAverage = pickValue<string>(
    reportOptions,
    [["showAverage"]],
    "both"
  )
  const legacyShowRank = pickValue(reportOptions, [["showRank"]], true)
  const legacyRankType = pickValue<string>(
    reportOptions,
    [["rankType"]],
    "both"
  )
  const graphOptions = readJsonPath(reportOptions, ["graphOptions"])

  const statisticCells: Array<{
    statisticKind: string
    scope: string
    shown: boolean
  }> = [
    {
      statisticKind: "average",
      scope: "classroom",
      shown: legacyAverage === "class" || legacyAverage === "both",
    },
    {
      statisticKind: "average",
      scope: "overall",
      shown: legacyAverage === "overall" || legacyAverage === "both",
    },
    { statisticKind: "deviation", scope: "classroom", shown: false },
    {
      statisticKind: "deviation",
      scope: "overall",
      shown: pickValue(reportOptions, [["showDeviation"]], true),
    },
    {
      statisticKind: "rank",
      scope: "classroom",
      shown:
        legacyShowRank &&
        (legacyRankType === "class" || legacyRankType === "both"),
    },
    {
      statisticKind: "rank",
      scope: "overall",
      shown:
        legacyShowRank &&
        (legacyRankType === "overall" || legacyRankType === "both"),
    },
    { statisticKind: "boxPlot", scope: "classroom", shown: false },
    {
      statisticKind: "boxPlot",
      scope: "overall",
      shown: pickValue(graphOptions, [["showBoxPlot"]], true),
    },
  ]

  examData.individualReportStatisticVisibilities = statisticCells.map(
    (cell) => ({
      id: `${examId}:${cell.statisticKind}:${cell.scope}`,
      examId,
      ...cell,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  )
  examData.individualReportGraphSettings = {
    id: examId,
    examId,
    showBarChart: pickValue(graphOptions, [["showBarChart"]], true),
    showRadarChart: pickValue(graphOptions, [["showRadarChart"]], true),
    showTotalScoreBoxPlot: pickValue(
      graphOptions,
      [["showOverallBoxPlot"]],
      false
    ),
    boxPlotGroupSelectionEnabled: pickValue(
      reportOptions,
      [["boxPlotSubtotalGroupSelection", "enabled"]],
      false
    ),
    showBoxPlotMin: pickValue(graphOptions, [["showBoxPlotMin"]], true),
    showBoxPlotQ1: pickValue(graphOptions, [["showBoxPlotQ1"]], true),
    showBoxPlotMedian: pickValue(graphOptions, [["showBoxPlotMedian"]], true),
    showBoxPlotQ3: pickValue(graphOptions, [["showBoxPlotQ3"]], true),
    showBoxPlotMax: pickValue(graphOptions, [["showBoxPlotMax"]], true),
    showAverageLine: pickValue(graphOptions, [["showAverageLine"]], true),
    showStudentMarker: pickValue(graphOptions, [["showStudentMarker"]], true),
    boxPlotFontSize: pickValue(graphOptions, [["boxPlotFontSize"]], 11),
    boxPlotItemHeight: pickValue(graphOptions, [["boxPlotItemHeight"]], 20),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
