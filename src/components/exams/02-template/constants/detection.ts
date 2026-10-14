/**
 * 採点枠自動認識機能の定数
 */

import type { DetectionMode, DetectionSettings } from "../types"

/**
 * デフォルトの検出設定（シンプル版）
 */
export const DEFAULT_DETECTION_SETTINGS: DetectionSettings = {
  minLineLengthMm: 6, // 6mm 以上の連なりを罫線とみなす
  minDividerLength: 0.9, // 枠の幅（高さ）の9割以上ある線は、壁に届かなくても仕切りとみなす
  minWidthMm: 4,
  minHeightMm: 3,
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
