import type {
  ExamReportGraphSettingsValues,
  ExamReportTableSectionValues,
} from "@/electron-src/lib/prisma/examSettings"
import type {
  GraphOptions,
  IndividualReportOptions,
} from "@/types/individualReport.types"
import type {
  AnswerOverlaySettings,
  AnswerOverlayStyle,
  AnswerOverlayVisibility,
} from "@/types/scoringOverlay.types"
import { OVERLAY_KINDS } from "@/types/scoringOverlay.types"
import { SCORING_STATUSES } from "@/types/scoringStatus.types"

/**
 * 出力設定の「どの行が変わったか」。
 *
 * 出力設定は6つのテーブルに分かれている。設定UIは一式（`AnswerOverlaySettings` /
 * `IndividualReportOptions`）を渡してくるので、**書く直前にここで行へ割る**。
 * 割らずに一式を送ると、フォントサイズを1文字打つたびに20行以上へ書きに行く。
 *
 * UI 側を意図ごとのコールバックに作り替えるのではなく1箇所で割るのは、そうすれば
 * どの入力欄も「送り忘れ」を起こしようがないため。
 */
export type ExportSettingChange =
  | { kind: "overlayStyle"; style: AnswerOverlayStyle }
  | { kind: "overlayVisibility"; visibility: AnswerOverlayVisibility }
  | {
      /**
       * 統計の可視性1マス。種別と母集団は文字列で運ぶ。
       *
       * 綴りの一覧（`STATISTIC_KINDS`）は main 側の値なので renderer からは
       * 引けない。main が読み出しと同じ正規化（`toStatisticKind`）を通すので、
       * 想定外の綴りが行になることはない。
       */
      kind: "statisticVisibility"
      statisticKind: string
      scope: string
      shown: boolean
    }
  | { kind: "reportSettings"; individualReport: IndividualReportOptions }
  | {
      kind: "reportTableSection"
      tableKind: string
      values: ExamReportTableSectionValues
    }
  | { kind: "reportGraphSettings"; values: ExamReportGraphSettingsValues }

/**
 * 行の値だけを比べる。
 *
 * 同定（`id` / `examId` / 種別）と履歴（時刻）は落とす。既定値の行はプレースホルダの
 * id と epoch の時刻を持っており、そこを見ると常に「変わった」ことになる。
 *
 * **列を並べて書かない**（引き算で決める）ので、列を足しても比較対象へ自動で入る。
 */
function isSameRowValues(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  const ignored = new Set(["id", "examId", "createdAt", "updatedAt"])
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    if (ignored.has(key)) continue
    if (previous[key] !== next[key]) return false
  }
  return true
}

/** 入れ子のある素の値を比べる（`adviceOptions` のような小さな入れ物用） */
function isDeepEqual(previous: unknown, next: unknown): boolean {
  if (previous === next) return true
  if (
    typeof previous !== "object" ||
    typeof next !== "object" ||
    previous === null ||
    next === null
  ) {
    return false
  }
  if (Array.isArray(previous) || Array.isArray(next)) {
    if (!Array.isArray(previous) || !Array.isArray(next)) return false
    return (
      previous.length === next.length &&
      previous.every((item, index) => isDeepEqual(item, next[index]))
    )
  }
  const previousRecord = previous as Record<string, unknown>
  const nextRecord = next as Record<string, unknown>
  const keys = new Set([
    ...Object.keys(previousRecord),
    ...Object.keys(nextRecord),
  ])
  for (const key of keys) {
    if (!isDeepEqual(previousRecord[key], nextRecord[key])) return false
  }
  return true
}

/** 重ね描き設定のうち、行が変わったものだけを拾う */
export function answerOverlayChanges(
  previous: AnswerOverlaySettings,
  next: AnswerOverlaySettings
): ExportSettingChange[] {
  const changes: ExportSettingChange[] = []

  for (const overlayKind of OVERLAY_KINDS) {
    if (
      !isSameRowValues(previous.styles[overlayKind], next.styles[overlayKind])
    ) {
      changes.push({ kind: "overlayStyle", style: next.styles[overlayKind] })
    }
  }

  for (const status of SCORING_STATUSES) {
    if (
      !isSameRowValues(previous.visibility[status], next.visibility[status])
    ) {
      changes.push({
        kind: "overlayVisibility",
        visibility: next.visibility[status],
      })
    }
  }

  return changes
}

/** 表の節（小計・設問）1つ分の値を取り出す */
function tableSectionValues(
  options: IndividualReportOptions,
  tableKind: "subtotal" | "question"
): ExamReportTableSectionValues {
  return tableKind === "subtotal"
    ? {
        enabled: options.showSubtotalTable,
        columns: options.subtotalTableColumns,
        fontSize: options.subtotalTableFontSize,
      }
    : {
        enabled: options.showQuestionTable,
        columns: options.questionTableColumns,
        fontSize: options.questionTableFontSize,
      }
}

/**
 * 列でない項目を持っていたら `never` になる型。
 *
 * 下でグラフのオプションをそのまま行の値として渡すため、**列に無い項目が増えたら
 * 型で落とす**。展開（spread）は余分なプロパティの検査を素通りするので、実行時に
 * Prisma が「そんな列は無い」と言うまで気づけない。
 */
type OnlyColumnsOf<TValue, TRow> =
  Exclude<keyof TValue, keyof TRow> extends never ? TValue : never

/** グラフ設定1行分の値を取り出す */
function graphSettingsValues(
  options: IndividualReportOptions
): ExamReportGraphSettingsValues {
  const graphOptions: OnlyColumnsOf<
    GraphOptions,
    ExamReportGraphSettingsValues
  > = options.graphOptions

  return {
    ...graphOptions,
    boxPlotGroupSelectionEnabled: options.boxPlotSubtotalGroupSelection.enabled,
  }
}

/**
 * 設定本体の行に載る部分を取り出す。
 *
 * **他の行が持つものを引いた残り**として作る。オプションに項目が増えたときは
 * 自動的にここへ入るので、「比較に足し忘れて書き込みが黙って落ちる」が起きない
 * （落ちるより、余分に1行書くほうが安全な向きに倒してある）。
 */
function reportSettingsResidual(
  options: IndividualReportOptions
): Record<string, unknown> {
  const {
    statistics: _statistics,
    showSubtotalTable: _showSubtotalTable,
    subtotalTableColumns: _subtotalTableColumns,
    subtotalTableFontSize: _subtotalTableFontSize,
    showQuestionTable: _showQuestionTable,
    questionTableColumns: _questionTableColumns,
    questionTableFontSize: _questionTableFontSize,
    graphOptions: _graphOptions,
    boxPlotSubtotalGroupSelection: _boxPlotSubtotalGroupSelection,
    tableSubtotalGroupSelection,
    ...residual
  } = options

  // 選ばれたグループの id は ExamSubtotalGroup のフラグが正本。設定の行が持つのは
  // 「絞り込みを使うか」だけなので、そこだけを残す
  return {
    ...residual,
    tableGroupSelectionEnabled: tableSubtotalGroupSelection.enabled,
  }
}

/** 個人成績表の設定のうち、行が変わったものだけを拾う */
export function individualReportChanges(
  previous: IndividualReportOptions,
  next: IndividualReportOptions
): ExportSettingChange[] {
  const changes: ExportSettingChange[] = []

  if (
    !isDeepEqual(reportSettingsResidual(previous), reportSettingsResidual(next))
  ) {
    changes.push({ kind: "reportSettings", individualReport: next })
  }

  for (const tableKind of ["subtotal", "question"] as const) {
    const nextValues = tableSectionValues(next, tableKind)
    if (!isDeepEqual(tableSectionValues(previous, tableKind), nextValues)) {
      changes.push({
        kind: "reportTableSection",
        tableKind,
        values: nextValues,
      })
    }
  }

  const nextGraph = graphSettingsValues(next)
  if (!isDeepEqual(graphSettingsValues(previous), nextGraph)) {
    changes.push({ kind: "reportGraphSettings", values: nextGraph })
  }

  // 種別×母集団のマスを、記録そのものの形から開く（綴りの一覧は main 側にある）。
  // `Map` に一度移すのは、綴りが文字列になった後でも前の値を引けるようにするため
  const previousStatistics = new Map(Object.entries(previous.statistics))
  for (const [statisticKind, scopes] of Object.entries(next.statistics)) {
    const previousScopes = new Map(
      Object.entries(previousStatistics.get(statisticKind) ?? {})
    )
    for (const [scope, shown] of Object.entries(scopes)) {
      if (previousScopes.get(scope) !== shown) {
        changes.push({
          kind: "statisticVisibility",
          statisticKind,
          scope,
          shown,
        })
      }
    }
  }

  return changes
}
