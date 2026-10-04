/** 系列が合計得点率を見ているときの `subtotalId` */
export const TOTAL_SUBTOTAL_ID = "__total__"

/** 推移グラフの1系列（生徒・学級で共通の部分） */
export interface TrendSeries {
  id: string
  label: string
  tags: Set<string>
  /** {@link TOTAL_SUBTOTAL_ID} か、小計の id */
  subtotalId: string
  color: string
}

/** 系列の小計として選べるもの */
export interface SubtotalOption {
  id: string
  label: string
  groupName: string
}
