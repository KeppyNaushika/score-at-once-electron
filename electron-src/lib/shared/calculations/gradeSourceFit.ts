/**
 * データソースごとの「モデル適合度 R」（手法選択画面の判断材料）。
 *
 * 素点行列は成績算出と同じ組み立て（`buildGradeCalcContext`）から取る。
 */

import { computeSourceFit } from "./absentEstimationRegression"
import { buildGradeCalcContext } from "./gradeCalculationContext"

/**
 * 構造的兄弟ソースの同定キー。同一試験（examId）または同一資料（courseworkId）に属する
 * ソースは「合計＝小計の和」等の定義上の従属関係を持つ。生徒がその試験/資料を欠席すると
 * 兄弟も同時に欠測するため、モデル適合度 R の説明変数からは除外する（復元でなく予測のRを出す）。
 * グループに属さないソースは自身の id を返し、他と兄弟にならない。
 */
function siblingGroupKey(dataSource: {
  id: string
  examId: string | null
  coursework: { id: string } | null
  courseworkItem: { courseworkId: string } | null
}): string {
  if (dataSource.examId) return `exam:${dataSource.examId}`
  if (dataSource.coursework) return `cw:${dataSource.coursework.id}`
  if (dataSource.courseworkItem) {
    return `cw:${dataSource.courseworkItem.courseworkId}`
  }
  return `self:${dataSource.id}`
}

/**
 * 各データソースの「モデル適合度 R」を保存済みの推定ソース設定で算出する。
 * 手法選択（03-データソース）画面で「このソースが他ソースからどれだけ当てられるか」を示す。
 * R は手法に依らないデータ側の予測しやすさ＝重回帰の縮小率で、
 * 高いほど重回帰でも中心へ寄りにくい（順位法・標準偏差法は縮小そのものを避ける）。
 * @returns 各 dataSourceId → { correlation, sampleSize }（算出不能なソースは null）
 */
export async function computeSourceFits(
  gradeId: string
): Promise<Record<string, { correlation: number; sampleSize: number } | null>> {
  const context = await buildGradeCalcContext(gradeId)
  if (!context) {
    throw new Error("Grade exam not found")
  }
  const { dataSourceInfos, rawScoreMatrix, allDataSources } = context

  // 構造的兄弟（同一試験/資料）の同定キー。R算出時に説明変数から除外する。
  const groupKeyById = new Map<string, string>()
  for (const dataSource of allDataSources) {
    groupKeyById.set(dataSource.id, siblingGroupKey(dataSource))
  }

  const fits: Record<
    string,
    { correlation: number; sampleSize: number } | null
  > = {}
  for (const dataSourceInfo of dataSourceInfos) {
    const targetGroupKey = groupKeyById.get(dataSourceInfo.id)
    // 推定ソース: selected なら指定ID、all なら自ソース以外。満点0（算出ソース無し）は常に除く。
    // さらに両モードとも構造的兄弟（同一試験/資料）を除外する。合計=観点の和 等の派生関係は
    // R=1（＝予測ではなく復元）を生み現実の予測精度を表さないため。
    //
    // これは実際の推定挙動とも整合する: 生徒が試験を丸ごと欠席すると兄弟（同一試験の他観点/合計）も
    // 同時に欠測し、estimateByRegression の availablePredictors から自動的に外れる。合計・観点は
    // 派生値なので「兄弟だけ在る partial 欠測」は起きず、Rと推定が乖離するケースは生じない。
    // selected で兄弟のみ選んだ退化構成では R=算出不能 になるが、その構成では実推定も兄弟を使えず
    // average へ落ちるため、算出不能の表示は誠実（レビュー指摘#1への回答）。
    const predictors = (
      dataSourceInfo.estimationMode === "selected"
        ? dataSourceInfos.filter((candidate) =>
            dataSourceInfo.estimationSourceIds.includes(candidate.id)
          )
        : dataSourceInfos.filter(
            (candidate) => candidate.id !== dataSourceInfo.id
          )
    )
      .filter((candidate) => candidate.maxScore > 0)
      .filter((candidate) => groupKeyById.get(candidate.id) !== targetGroupKey)

    fits[dataSourceInfo.id] = computeSourceFit(
      dataSourceInfo,
      predictors,
      rawScoreMatrix
    )
  }
  return fits
}
