"use client"

import type { ReactNode } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { GradeItemResult, SourceScoreResult } from "@/types/grade.types"

// ---------------------------------------------------------------------------
// GradeItemBreakdownPopover – %クリックで算出根拠を表示。
// データソース別の換算内訳と、欠測推定ソースの推定式（ネストpopover）を表示する。
// ---------------------------------------------------------------------------

const ABSENT_METHOD_LABELS: Record<string, string> = {
  zero: "0点",
  average: "平均比率法",
  regression: "重回帰法",
}

const FALLBACK_REASON_LABELS: Record<string, string> = {
  insufficient_samples: "サンプル不足",
  singular_matrix: "多重共線性（特異行列）",
}

/** 数値を小数digits桁で表示（末尾の余分な0は残す＝式の桁を揃える） */
function fmt(value: number, digits = 2): string {
  return value.toFixed(digits)
}

/** 数字1文字と同じ幅の空白（U+2007）。tabular-nums と併用で桁が縦に揃う。 */
const FIGURE_SPACE = " "

/**
 * 同じ列に並ぶ数値文字列を、小数点の位置で縦に揃えつつ全行を同じ文字幅になるよう
 * figure space でパディングして返す。等幅になるので、セル側は普通に text-center
 * するだけで「桁は揃ったままブロックごと中央」に置ける。
 * 数値として解釈できない要素（"—" / "欠" / "-" 等）はそのまま返す。
 */
function alignColumn(cells: string[]): string[] {
  const parsed = cells.map((cell) => /^(-?\d+)(\.\d+)?(%?)$/.exec(cell))
  const maxInt = Math.max(0, ...parsed.map((match) => match?.[1].length ?? 0))
  const maxFrac = Math.max(0, ...parsed.map((match) => match?.[2]?.length ?? 0))
  const maxSuffix = Math.max(
    0,
    ...parsed.map((match) => match?.[3]?.length ?? 0)
  )
  return cells.map((cell, index) => {
    const match = parsed[index]
    if (!match) return cell
    const intPart = match[1]
    const fracPart = match[2] ?? ""
    const suffix = match[3] ?? ""
    return (
      FIGURE_SPACE.repeat(maxInt - intPart.length) +
      intPart +
      fracPart +
      FIGURE_SPACE.repeat(maxFrac - fracPart.length) +
      suffix +
      FIGURE_SPACE.repeat(maxSuffix - suffix.length)
    )
  })
}

/** クランプ判定の許容誤差（丸め・浮動小数のブレを吸収） */
const CLAMP_EPSILON = 0.005

/**
 * クランプ前の値 rawValue が最終値 finalValue と乖離＝[0, maxScore]にクランプされた場合の
 * 注記文字列を返す（乖離がなければ空文字）。内訳表示の各所で共有する。
 */
function clampNote(
  rawValue: number,
  finalValue: number,
  maxScore: number
): string {
  return Math.abs(rawValue - finalValue) > CLAMP_EPSILON
    ? `（0〜${fmt(maxScore)}にクランプ）`
    : ""
}

/** 内訳テーブルの数値見出しセル（中央揃え・折返し無し） */
const ESTIMATION_TH = "pb-0.5 text-center font-medium whitespace-nowrap"
/** 合計行の上罫線 */
const ESTIMATION_TOTAL_ROW =
  "border-t border-amber-300/60 font-semibold dark:border-amber-700/60"

/**
 * GradeItem内訳テーブルの数値見出し（中央揃え・折返し無し）。
 * table-fixed 下では見出しセルの w-* が列幅を決める（本文セルはこれに追従）。
 * 列幅を変えたいときはこの w-16 を調整する。
 */
const PARENT_TH_NUM = "w-16 pb-1 text-center font-medium whitespace-nowrap"

/**
 * 数値セル。中身は alignColumn で列内を等幅（figure spaceパディング）に揃えた
 * 文字列を渡す前提。等幅なので text-center で桁を保ったまま中央に置ける。
 */
function NumCell({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={`text-center whitespace-nowrap tabular-nums ${className}`}
    >
      {children}
    </td>
  )
}

/** 計算の流れ1行（ラベル左・数値右揃え）。式や注記を添えられる。 */
function EstimationFlowRow({
  label,
  formula,
  value,
  note,
  strong = false,
}: {
  label: string
  formula?: string
  value: string
  note?: string
  strong?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 ${strong ? "font-semibold" : ""}`}
    >
      <span>
        {label}
        {formula && (
          <span className="ml-1 text-amber-700/70 dark:text-amber-300/70">
            ({formula})
          </span>
        )}
      </span>
      <span className="whitespace-nowrap tabular-nums">
        {value}
        {note && (
          <span className="ml-1 text-amber-700 dark:text-amber-300">
            {note}
          </span>
        )}
      </span>
    </div>
  )
}

/** 平均比率法: 使用ソースの素点/満点と比率、平均比率を表で示す。 */
function AverageBreakdown({
  sources,
  averageRatio,
}: {
  sources: NonNullable<SourceScoreResult["estimation"]>["averageSources"]
  averageRatio: number
}) {
  const sourceList = sources ?? []
  const scoreColumn = alignColumn(sourceList.map((source) => fmt(source.score)))
  const maxScoreColumn = alignColumn(
    sourceList.map((source) => fmt(source.maxScore))
  )
  const ratioColumn = alignColumn([
    ...sourceList.map((source) => fmt(source.ratio, 3)),
    fmt(averageRatio, 3),
  ])
  return (
    <table className="mt-1 w-full tabular-nums">
      <thead>
        <tr className="text-amber-700 dark:text-amber-300">
          <th className="pb-0.5 text-center font-medium">ソース</th>
          <th className={ESTIMATION_TH}>素点 / 満点</th>
          <th className={ESTIMATION_TH}>比率</th>
        </tr>
      </thead>
      <tbody>
        {sourceList.map((source, index) => (
          <tr key={source.id}>
            <td className="text-left">{source.name}</td>
            <NumCell>
              {scoreColumn[index]} / {maxScoreColumn[index]}
            </NumCell>
            <NumCell>{ratioColumn[index]}</NumCell>
          </tr>
        ))}
        <tr className={ESTIMATION_TOTAL_ROW}>
          <td className="pt-0.5 text-left" colSpan={2}>
            平均比率
          </td>
          <NumCell className="pt-0.5">
            {ratioColumn[ratioColumn.length - 1]}
          </NumCell>
        </tr>
      </tbody>
    </table>
  )
}

/** 重回帰法: 切片・各説明変数の係数/素点/寄与(係数×素点)と予測合計を表で示す。 */
function RegressionBreakdown({
  intercept,
  terms,
  droppedPredictors,
}: {
  intercept: number
  terms: { id: string; name: string; value: number; coefficient: number }[]
  droppedPredictors?: { id: string; name: string; value: number }[]
}) {
  const rawSum =
    intercept +
    terms.reduce((sum, term) => sum + term.coefficient * term.value, 0)
  const dropped = droppedPredictors ?? []
  const hasDropped = dropped.length > 0

  // 列ごとに等幅化（切片・各説明変数・予測合計をまたいで小数点を縦に揃える）
  const coefColumn = alignColumn([
    fmt(intercept, 3),
    ...terms.map((term) => fmt(term.coefficient, 3)),
  ])
  const scoreColumn = alignColumn([
    ...terms.map((term) => fmt(term.value)),
    ...dropped.map((droppedPredictor) => fmt(droppedPredictor.value)),
  ])
  const contribColumn = alignColumn([
    fmt(intercept),
    ...terms.map((term) => fmt(term.coefficient * term.value)),
    fmt(rawSum),
  ])

  return (
    <div className="mt-1">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="text-amber-700 dark:text-amber-300">
            <th className="pb-0.5 text-center font-medium">説明変数</th>
            <th className={ESTIMATION_TH}>係数</th>
            <th className={ESTIMATION_TH}>素点</th>
            <th className={ESTIMATION_TH}>寄与</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-left">切片</td>
            <NumCell>{coefColumn[0]}</NumCell>
            <NumCell className="text-amber-700/50 dark:text-amber-300/50">
              —
            </NumCell>
            <NumCell>{contribColumn[0]}</NumCell>
          </tr>
          {terms.map((term, index) => (
            <tr key={term.id}>
              <td className="text-left">{term.name}</td>
              <NumCell>{coefColumn[index + 1]}</NumCell>
              <NumCell>{scoreColumn[index]}</NumCell>
              <NumCell>{contribColumn[index + 1]}</NumCell>
            </tr>
          ))}
          {dropped.map((droppedPredictor, index) => (
            <tr
              key={droppedPredictor.id}
              className="text-amber-700/60 line-through dark:text-amber-300/60"
            >
              <td className="text-left">{droppedPredictor.name}</td>
              <NumCell>—</NumCell>
              <NumCell>{scoreColumn[terms.length + index]}</NumCell>
              <NumCell>—</NumCell>
            </tr>
          ))}
          <tr className={ESTIMATION_TOTAL_ROW}>
            <td className="pt-0.5 text-left" colSpan={3}>
              予測合計
            </td>
            <NumCell className="pt-0.5">
              {contribColumn[contribColumn.length - 1]}
            </NumCell>
          </tr>
        </tbody>
      </table>
      {hasDropped && (
        <p className="mt-0.5 text-amber-700/70 dark:text-amber-300/70">
          打ち消し線 = 多重共線性・定数列のため回帰から除外
        </p>
      )}
    </div>
  )
}

/**
 * 欠測推定の内訳（どの方法・どの式で推定したか）を表示するブロック。
 * average / regression は内訳を表で示し、末尾に推定素点→乗率→最終の流れを揃える。
 */
function EstimationExplain({
  sourceScore,
}: {
  sourceScore: SourceScoreResult
}) {
  const estimation = sourceScore.estimation
  if (!estimation) return null

  const methodLabel =
    ABSENT_METHOD_LABELS[estimation.effectiveMethod] ??
    estimation.effectiveMethod
  const targetMaxScore = sourceScore.maxScore
  const hasAdjustment = estimation.ratio !== 1 || estimation.offset !== 0
  const isRegression =
    estimation.effectiveMethod === "regression" &&
    estimation.intercept !== undefined &&
    estimation.regressionTerms !== undefined
  const isAverage =
    estimation.averageSources !== undefined &&
    estimation.averageRatio !== undefined

  // クランプ前の生の推定値（内部クランプで baseEstimate になる前）。
  // regression=予測合計、average=平均比率×満点。これと baseEstimate の乖離でクランプ有無を判定。
  const preEstimateRaw = isRegression
    ? estimation.intercept! +
      estimation.regressionTerms!.reduce(
        (sum, term) => sum + term.coefficient * term.value,
        0
      )
    : isAverage
      ? estimation.averageRatio! * targetMaxScore
      : estimation.baseEstimate
  // 乗率・加減点適用後（クランプ前）。乗率等が無ければ推定素点そのもの。
  const preClampScore = hasAdjustment
    ? estimation.adjustedScore
    : estimation.baseEstimate

  return (
    <div className="rounded-md bg-amber-50 p-2.5 text-[10px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">
        {sourceScore.dataSourceName}（欠測推定: {methodLabel}）
      </p>

      {estimation.fallbackReason && (
        <p className="text-amber-700 dark:text-amber-300">
          ※ 重回帰法は
          {FALLBACK_REASON_LABELS[estimation.fallbackReason] ??
            estimation.fallbackReason}
          のため平均比率法にフォールバック
        </p>
      )}

      {estimation.effectiveMethod === "zero" && (
        <p className="mt-0.5">欠測 → 0点</p>
      )}

      {isAverage && (
        <AverageBreakdown
          sources={estimation.averageSources}
          averageRatio={estimation.averageRatio!}
        />
      )}

      {isRegression && (
        <RegressionBreakdown
          intercept={estimation.intercept!}
          terms={estimation.regressionTerms!}
          droppedPredictors={estimation.droppedPredictors}
        />
      )}

      <div className="mt-1.5 space-y-0.5 border-t border-amber-300/60 pt-1 dark:border-amber-700/60">
        <EstimationFlowRow
          label="推定素点"
          formula={
            isAverage
              ? `${fmt(estimation.averageRatio!, 3)} × ${fmt(targetMaxScore)}`
              : undefined
          }
          value={fmt(estimation.baseEstimate)}
          note={clampNote(
            preEstimateRaw,
            estimation.baseEstimate,
            targetMaxScore
          )}
        />
        {hasAdjustment && (
          <EstimationFlowRow
            label="乗率・加減点"
            formula={`× ${estimation.ratio} ${estimation.offset >= 0 ? "+" : "−"} ${fmt(Math.abs(estimation.offset))}`}
            value={fmt(estimation.adjustedScore)}
          />
        )}
        <EstimationFlowRow
          label="最終スコア"
          value={fmt(estimation.finalScore)}
          note={clampNote(preClampScore, estimation.finalScore, targetMaxScore)}
          strong
        />
      </div>
    </div>
  )
}

/** GradeItem列の%ポップオーバー: データソース別の内訳 */
export function GradeItemBreakdownPopover({
  itemResult,
  hasEstimated,
}: {
  itemResult: GradeItemResult
  hasEstimated: boolean
}) {
  const pctText =
    itemResult.percentage !== null && itemResult.percentage !== undefined
      ? `${itemResult.percentage.toFixed(1)}%${hasEstimated ? "*" : ""}`
      : "-"

  const colorClass = itemResult.isAllMissing
    ? "text-red-500"
    : hasEstimated
      ? "text-amber-600"
      : ""

  if (itemResult.sourceScores.length === 0) {
    return (
      <span className={`w-12 text-right text-xs tabular-nums ${colorClass}`}>
        {pctText}
      </span>
    )
  }

  // 列ごとに等幅化（本文の各ソース行と合計・得点率行をまたいで小数点を縦に揃える）
  const sources = itemResult.sourceScores
  const rawScoreColumn = alignColumn(
    sources.map((source) =>
      source.rawScore !== null ? String(source.rawScore) : "-"
    )
  )
  const maxScoreColumn = alignColumn(
    sources.map((source) => String(source.maxScore))
  )
  const weightedColumn = alignColumn([
    ...sources.map((source) =>
      source.weightedScore !== null ? source.weightedScore.toFixed(2) : "欠"
    ),
    itemResult.weightedScore !== null
      ? itemResult.weightedScore.toFixed(2)
      : "-",
  ])
  const weightMaxColumn = alignColumn([
    ...sources.map((source) => String(source.weight)),
    itemResult.weightedMaxScore.toFixed(1),
    itemResult.percentage !== null
      ? `${itemResult.percentage.toFixed(1)}%`
      : "-",
  ])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-12 cursor-pointer text-right text-xs tabular-nums hover:underline ${colorClass}`}
          title="クリックで内訳を表示"
        >
          {pctText}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[32rem] p-3" align="start">
        <p className="mb-1 text-xs font-semibold">{itemResult.gradeItemName}</p>
        <p className="text-muted-foreground mb-2 text-[10px]">
          換算 = (素点 ÷ 満点) × 換算満点 ※欠点は除外
        </p>
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="pb-1 text-center font-medium">項目</th>
              <th className={PARENT_TH_NUM}>素点</th>
              <th className={PARENT_TH_NUM}>満点</th>
              <th className={PARENT_TH_NUM}>換算</th>
              <th className={PARENT_TH_NUM}>換算満点</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((sourceScore, index) => {
              const isMissing = sourceScore.weightedScore === null
              return (
                <tr
                  key={sourceScore.dataSourceId}
                  className={`border-b last:border-0 ${isMissing ? "text-muted-foreground line-through" : ""}`}
                >
                  <td className="py-1 pr-1">
                    {sourceScore.isEstimated && sourceScore.estimation ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="cursor-pointer text-left text-amber-600 hover:underline"
                            title="クリックで推定の計算式を表示"
                          >
                            {sourceScore.dataSourceName}
                            <span className="ml-0.5">*</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[32rem] p-0" align="start">
                          <EstimationExplain sourceScore={sourceScore} />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      sourceScore.dataSourceName
                    )}
                  </td>
                  <NumCell className="py-1">{rawScoreColumn[index]}</NumCell>
                  <NumCell className="py-1">{maxScoreColumn[index]}</NumCell>
                  <NumCell className="py-1">{weightedColumn[index]}</NumCell>
                  <NumCell className="py-1">{weightMaxColumn[index]}</NumCell>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="pt-1" colSpan={3}>
                合計（欠点除外）
              </td>
              <NumCell className="pt-1">
                {weightedColumn[weightedColumn.length - 1]}
              </NumCell>
              <NumCell className="pt-1">
                {weightMaxColumn[weightMaxColumn.length - 2]}
              </NumCell>
            </tr>
            <tr className="font-medium">
              <td className="pt-1" colSpan={4}>
                得点率
              </td>
              <NumCell className="pt-1">
                {weightMaxColumn[weightMaxColumn.length - 1]}
              </NumCell>
            </tr>
          </tfoot>
        </table>
      </PopoverContent>
    </Popover>
  )
}
