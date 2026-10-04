/**
 * 欠測時の代替スコア推定
 * 素点行列（RawScoreMatrix）には推定前の実スコアのみが格納される（循環推定の防止）。
 * - zero: 0点
 * - average: 同一生徒の他DataSource比率の平均 × 満点
 * - regression: OLS重回帰による予測。多重共線性（合計＝小計の和など）で線形従属になった
 *   説明変数はランク落ちで除外して残りの独立列で継続する。独立列が1つも残らない場合や
 *   サンプル不足の場合のみ average にフォールバックする。
 *
 * 推定対象は行（対象者）と列（データソース）の実体で指定する。以前は studentId と
 * dataSourceId をそれぞれ string で受けており、取り違えても型では捕まらなかった。
 *
 * ここは手法の振り分けと、推定値への乗率・加減点の適用だけを持つ。各手法の本体は
 * `absentEstimationAverage.ts`（平均比率法と共有の土台）・`absentEstimationRegression.ts`
 * （重回帰法）・`absentEstimationEquating.ts`（標準偏差法・順位法）にある。
 */

import type { AbsentMethod } from "../../../../src/types/grade.types"
import {
  type AbsentEstimation,
  clamp,
  estimateByAverage,
  type EstimationMatrix,
  type EstimationRow,
} from "./absentEstimationAverage"
import {
  estimateByEquipercentile,
  estimateByZScore,
} from "./absentEstimationEquating"
import { estimateByRegression } from "./absentEstimationRegression"
import type { DataSourceInfo } from "./gradeCalculatorTypes"

/**
 * 欠測時の代替スコアを推定
 */
export function estimateAbsentScore(
  method: AbsentMethod,
  targetRow: EstimationRow,
  dataSource: DataSourceInfo,
  matrix: EstimationMatrix,
  allDataSources: DataSourceInfo[]
): AbsentEstimation | null {
  if (method === "zero") {
    return { value: 0, effectiveMethod: "zero" }
  }
  if (method === "average") {
    return estimateByAverage(targetRow, dataSource, matrix, allDataSources)
  }
  if (method === "regression") {
    return estimateByRegression(targetRow, dataSource, matrix, allDataSources)
  }
  if (method === "equipercentile") {
    return estimateByEquipercentile(
      targetRow,
      dataSource,
      matrix,
      allDataSources
    )
  }
  if (method === "zscore") {
    return estimateByZScore(targetRow, dataSource, matrix, allDataSources)
  }
  return null
}

/**
 * 乗率・加減点を適用した生の値（クランプ前）: estimated × ratio + offset。
 * applyAdjustmentAndClamp と結果画面の内訳表示が同じ式を共有するための単一実装
 * （表示側で式を再導出しないための SSOT）。
 */
export function adjustEstimate(
  estimated: number,
  ratio: number,
  offset: number
): number {
  return estimated * ratio + offset
}

/**
 * 調整(ratio/offset)を適用し、[0, maxScore]にクランプ
 */
export function applyAdjustmentAndClamp(
  estimated: number,
  ratio: number,
  offset: number,
  maxScore: number
): number {
  return (
    Math.round(
      clamp(adjustEstimate(estimated, ratio, offset), 0, maxScore) * 100
    ) / 100
  )
}
