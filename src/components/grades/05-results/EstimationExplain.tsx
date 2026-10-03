import type { SourceScoreResult } from "@/types/grade.types"

import { alignColumn, fmt, NumCell } from "./BreakdownCells"

const ABSENT_METHOD_LABELS: Record<string, string> = {
  zero: "0点",
  average: "平均比率法",
  regression: "重回帰法",
  equipercentile: "順位法",
  zscore: "標準偏差法",
}

const FALLBACK_REASON_LABELS: Record<string, string> = {
  insufficient_samples: "サンプル不足",
  singular_matrix: "多重共線性（特異行列）",
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
export function EstimationExplain({
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
          ※ 選択した推定法は
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

      {isRegression && estimation.correlation !== undefined && (
        <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
          予測の確かさ: 相関 R = {fmt(estimation.correlation, 2)}
          {estimation.correlation >= 0.999
            ? "（他ソースから完全再現＝定義上のつながり。予測ではなく復元）"
            : `（実力の約${Math.round(estimation.correlation * 100)}%を反映／残り約${100 - Math.round(estimation.correlation * 100)}%は中心へ寄る）`}
        </p>
      )}

      {estimation.effectiveMethod === "zscore" &&
        estimation.standardizedStanding !== undefined &&
        estimation.targetMean !== undefined &&
        estimation.targetStandardDeviation !== undefined && (
          <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
            他ソースでの平均標準得点 z ={" "}
            {estimation.standardizedStanding >= 0 ? "+" : ""}
            {fmt(
              estimation.standardizedStanding,
              2
            )} を、当ソース分布（平均 {fmt(estimation.targetMean)} ／ 標準偏差{" "}
            {fmt(estimation.targetStandardDeviation)}
            ）へ載せ替え（縮小を打ち消す）
          </p>
        )}

      {estimation.effectiveMethod === "equipercentile" &&
        estimation.percentileRank !== undefined && (
          <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
            他ソースでの平均順位 上位{" "}
            {Math.round((1 - estimation.percentileRank) * 100)}
            %（パーセンタイル {Math.round(estimation.percentileRank * 100)}
            ）を、 当ソース実分布の同順位の点へ変換（分布を保存）
          </p>
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
