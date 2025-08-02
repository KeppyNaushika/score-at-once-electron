import type {
  ScoringMarkConfig,
  ScoringStatus,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoring-mark-types"
import {
  defaultConfig,
  STORAGE_KEY,
} from "@/components/projects/08-export/components/scoring-mark-settings/constants/scoring-mark-constants"

// localStorageから設定を読み込む
export function loadConfigFromStorage(): ScoringMarkConfig {
  if (typeof window === "undefined") return defaultConfig

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...defaultConfig,
        ...parsed,
        showMarkForStatus: {
          ...defaultConfig.showMarkForStatus,
          ...(parsed.showMarkForStatus || {}),
        },
        showScoreForStatus: {
          ...defaultConfig.showScoreForStatus,
          ...(parsed.showScoreForStatus || {}),
        },
      }
    }
  } catch (error) {
    console.error("Failed to load config from localStorage:", error)
  }

  return defaultConfig
}

// localStorageに設定を保存する
export function saveConfigToStorage(config: ScoringMarkConfig) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error("Failed to save config to localStorage:", error)
  }
}

// マーク画像パスを取得
export function getMarkImagePath(status: ScoringStatus, useTransparent: boolean): string {
  const prefix = useTransparent ? "tranceparent_" : ""
  switch (status) {
    case "unscored":
      return `/score-assets/${prefix}unscored.png`
    case "correct":
      return `/score-assets/${prefix}correct.png`
    case "incorrect":
      return `/score-assets/${prefix}incorrect.png`
    case "partial":
      return `/score-assets/${prefix}partial.png`
    case "pending":
      return `/score-assets/${prefix}partial.png` // 処理中は部分点マークを使用
    case "no_answer":
      return `/score-assets/${prefix}incorrect.png` // 無答も誤答マークを使用
    default:
      return `/score-assets/${prefix}unscored.png`
  }
}
