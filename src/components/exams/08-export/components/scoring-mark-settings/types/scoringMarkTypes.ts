import type { ScoringStatus } from "@/types/scoringStatus.types"

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

// 点数テキスト設定の共通型
export interface ScoreTextConfig {
  position: MarkPosition
  offsetX: number // X軸オフセット（-100 to 100）
  offsetY: number // Y軸オフセット（-100 to 100）
  size: number // 点数サイズ（8 to 48）
  alignment: TextAlignment
  color: string // 文字色（HEX形式 #RRGGBB）
  opacity: number // 不透明度（0 to 100）
}

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
  markColor: string // 採点記号マークの色（HEX形式 #RRGGBB、source-inで着色）
  markOpacity: number // 採点記号マークの不透明度（0 to 100）

  // 点数テキスト用設定（後方互換性のために維持）
  scorePosition: MarkPosition
  scoreOffsetX: number // X軸オフセット（-100 to 100）
  scoreOffsetY: number // Y軸オフセット（-100 to 100）
  scoreSize: number // 点数サイズ（8 to 48）
  scoreAlignment: TextAlignment

  // 部分点（設問ごとの点数）用設定
  partialScore: ScoreTextConfig

  // 小計・合計点用設定（後方互換性のため維持）
  summaryScore: ScoreTextConfig

  // 小計点用設定
  subtotalScore: ScoreTextConfig

  // 合計点用設定
  totalScore: ScoreTextConfig

  // PDF設定
  pageSize: PageSize
  pageOrientation: PageOrientation
  marginPercent: number // 余白パーセント（0-20）
}
