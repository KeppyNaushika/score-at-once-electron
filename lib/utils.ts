import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 選択枠色の設定
export interface SelectionBorderSettings {
  color: string
  isPreset: boolean
}

export const DEFAULT_SELECTION_BORDER_COLOR = "#F97316" // orange-500

// プリセット色（大文字HEXで統一）
export const SELECTION_BORDER_COLORS: Record<string, { color: string }> = {
  "#F97316": { color: "#F97316" }, // オレンジ
  "#3B82F6": { color: "#3B82F6" }, // 青
  "#EF4444": { color: "#EF4444" }, // 赤
  "#10B981": { color: "#10B981" }, // エメラルド
  "#8B5CF6": { color: "#8B5CF6" }, // バイオレット
  "#F59E0B": { color: "#F59E0B" }, // アンバー
}

// プリセット色の配列（設定画面で使用）
export const SELECTION_BORDER_PRESETS = Object.keys(SELECTION_BORDER_COLORS)

/**
 * 選択枠色の設定を取得
 * プリセット色またはカスタム色を返す
 */
export function getSelectionBorderSettings(): SelectionBorderSettings {
  if (typeof window === "undefined") {
    return { color: DEFAULT_SELECTION_BORDER_COLOR, isPreset: true }
  }

  const stored = localStorage.getItem("selectionBorderColor")
  const color = stored?.toUpperCase() || DEFAULT_SELECTION_BORDER_COLOR
  const isPreset = color in SELECTION_BORDER_COLORS

  return { color, isPreset }
}

/**
 * 選択枠色を保存
 * @param color HEX形式の色（例: #F97316）
 */
export function saveSelectionBorderColor(color: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("selectionBorderColor", color.toUpperCase())
  }
}
