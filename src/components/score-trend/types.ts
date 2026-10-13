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

/** 推移グラフの1点（試験1つ）のうち、生徒・学級で共通の部分 */
export interface TrendChartPointBase {
  /** 点の同定。同じ日の試験もそれぞれ別の点になる */
  examId: string
  /** ツールチップに出す短い日付 */
  date: string
  /** 試験日の時刻値。点の並び順に使う */
  sortKey: number
  /** 試験日のその日の 0 時（端末の時刻）の時刻値。X 軸の目盛りの位置 */
  dayTime: number
  /**
   * X 軸に描く位置（時刻値）。ふだんは {@link dayTime} と同じで、ほかの点と最低間隔より
   * 近いときだけ左右に譲り合ってずらす。表示する日付には使わない
   */
  plotTime: number
  examName: string
}
