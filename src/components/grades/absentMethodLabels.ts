import type { AbsentMethod } from "@/types/grade.types"

/**
 * 欠測時の推定方法の名前。
 *
 * 1つのデータソースの設定（`02-items/EstimationSettingsPopover`）・一括設定
 * （`02-items/DataSourcesContainer`）・結果の算出根拠（`05-results/EstimationExplain`）が
 * 同じ名前で呼ぶよう、ここ1か所から引く。並びは選択肢の並び。
 */
export const ABSENT_METHOD_LABELS: Record<AbsentMethod, string> = {
  null: "なし",
  zero: "0点",
  average: "平均比率法",
  regression: "重回帰法",
  equipercentile: "順位法",
  zscore: "標準偏差法",
}
