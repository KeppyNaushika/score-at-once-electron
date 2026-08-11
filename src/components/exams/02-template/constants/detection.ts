/**
 * 採点枠自動認識機能の定数
 */

import type { DetectionMode, DetectionSettings } from "../types"

/**
 * デフォルトの検出設定（シンプル版）
 */
export const DEFAULT_DETECTION_SETTINGS: DetectionSettings = {
  lineExtension: 0, // 線の延長なし（UIスライダーで調整可能）
  minWidth: 0.02, // 画像幅の2%以上
  minHeight: 0.01, // 画像高さの1%以上
  sensitivity: 3, // 検出感度（1-5）
}

/**
 * デフォルトの検出モード
 */
export const DEFAULT_DETECTION_MODE: DetectionMode = "auto"

/**
 * 検出モードのラベル
 */
export const DETECTION_MODE_LABELS: Record<DetectionMode, string> = {
  auto: "自動検出",
  manual: "手動指定",
}

/**
 * オーバーレイ表示のスタイル設定
 */
export const OVERLAY_STYLES = {
  strokeColor: "rgba(59, 130, 246, 0.8)", // Tailwind blue-500
  strokeColorHover: "rgba(37, 99, 235, 1)", // Tailwind blue-600
  strokeWidth: 2,
  strokeWidthHover: 3,
  strokeDasharray: "5,5",
  fillColor: "rgba(59, 130, 246, 0.1)",
  fillColorHover: "rgba(59, 130, 246, 0.2)",
} as const
