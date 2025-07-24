import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 選択枠色の設定
export interface SelectionBorderSettings {
  color: string
  tailwindClass: string
}

export const DEFAULT_SELECTION_BORDER_COLOR = "#f97316" // orange-500
export const SELECTION_BORDER_COLORS = {
  "#f97316": { color: "#f97316", tailwindClass: "border-orange-500" }, // オレンジ
  "#3b82f6": { color: "#3b82f6", tailwindClass: "border-blue-500" }, // 青
  "#ef4444": { color: "#ef4444", tailwindClass: "border-red-500" }, // 赤
  "#10b981": { color: "#10b981", tailwindClass: "border-emerald-500" }, // エメラルド
  "#8b5cf6": { color: "#8b5cf6", tailwindClass: "border-violet-500" }, // バイオレット
  "#f59e0b": { color: "#f59e0b", tailwindClass: "border-amber-500" }, // アンバー
}

export function getSelectionBorderSettings(): SelectionBorderSettings {
  if (typeof window === "undefined") {
    return SELECTION_BORDER_COLORS[DEFAULT_SELECTION_BORDER_COLOR]
  }
  
  const stored = localStorage.getItem("selectionBorderColor")
  const color = stored || DEFAULT_SELECTION_BORDER_COLOR
  
  return SELECTION_BORDER_COLORS[color as keyof typeof SELECTION_BORDER_COLORS] || SELECTION_BORDER_COLORS[DEFAULT_SELECTION_BORDER_COLOR]
}

export function saveSelectionBorderColor(color: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("selectionBorderColor", color)
  }
}
