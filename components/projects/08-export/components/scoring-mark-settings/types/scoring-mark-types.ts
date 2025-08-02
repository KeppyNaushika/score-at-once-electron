// 採点状態の型定義
export type ScoringStatus =
  | "unscored" // 未採点
  | "correct" // 正答
  | "incorrect" // 誤答
  | "partial" // 部分点
  | "pending" // 処理中
  | "no_answer" // 無答

// 位置の型定義
export type MarkPosition =
  | "top-left" // 左上
  | "top-center" // 上
  | "top-right" // 右上
  | "middle-left" // 左
  | "middle-center" // 中央
  | "middle-right" // 右
  | "bottom-left" // 左下
  | "bottom-center" // 下
  | "bottom-right" // 右下

// テキスト配置の型定義
export type TextAlignment = "left" | "center" | "right"

// PDF設定の型定義
export type PageSize = "A4" | "A3" | "B4" | "B5" | "Letter"
export type PageOrientation = "portrait" | "landscape"

// 採点マーク設定の型定義
export interface ScoringMarkConfig {
  // 表示設定
  showMarkForStatus: Record<ScoringStatus, boolean>
  showScoreForStatus: Record<ScoringStatus, boolean>

  // 採点マーク用設定
  markPosition: MarkPosition
  markOffsetX: number // X軸オフセット（-100 to 100）
  markOffsetY: number // Y軸オフセット（-100 to 100）
  markSize: number // マークサイズ（20 to 200）

  // 点数テキスト用設定
  scorePosition: MarkPosition
  scoreOffsetX: number // X軸オフセット（-100 to 100）
  scoreOffsetY: number // Y軸オフセット（-100 to 100）
  scoreSize: number // 点数サイズ（8 to 48）
  scoreAlignment: TextAlignment

  // 透明度設定
  useTransparent: boolean

  // PDF設定
  pageSize: PageSize
  pageOrientation: PageOrientation
  marginPercent: number // 余白パーセント（0-20）
}
