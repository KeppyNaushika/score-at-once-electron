import type {
  MarkPosition,
  ScoreTextConfig,
  ScoringMarkConfig,
  ScoringStatus,
  TextAlignment,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoring-mark-types"
import {
  defaultConfig,
  defaultPartialScoreConfig,
  defaultSummaryScoreConfig,
  STORAGE_KEY,
} from "@/components/projects/08-export/components/scoring-mark-settings/constants/scoring-mark-constants"

/** 旧形式の設定（マイグレーション用） */
interface LegacyScoreConfig {
  scorePosition?: MarkPosition
  scoreOffsetX?: number
  scoreOffsetY?: number
  scoreSize?: number
  scoreAlignment?: TextAlignment
  partialScore?: ScoreTextConfig
  summaryScore?: ScoreTextConfig
  showMarkForStatus?: Record<string, boolean>
  showScoreForStatus?: Record<string, boolean>
}

// 既存設定からpartialScoreを作成（マイグレーション用）
function migrateToPartialScore(parsed: LegacyScoreConfig): ScoreTextConfig {
  // 既存のscore*設定がある場合はそれを使用
  if (parsed.scorePosition || parsed.scoreSize) {
    return {
      position: parsed.scorePosition || defaultPartialScoreConfig.position,
      offsetX: parsed.scoreOffsetX ?? defaultPartialScoreConfig.offsetX,
      offsetY: parsed.scoreOffsetY ?? defaultPartialScoreConfig.offsetY,
      size: parsed.scoreSize || defaultPartialScoreConfig.size,
      alignment: parsed.scoreAlignment || defaultPartialScoreConfig.alignment,
    }
  }
  return defaultPartialScoreConfig
}

// localStorageから設定を読み込む
export function loadConfigFromStorage(): ScoringMarkConfig {
  if (typeof window === "undefined") return defaultConfig

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as LegacyScoreConfig &
        Partial<ScoringMarkConfig>

      // partialScoreとsummaryScoreのマイグレーション処理
      const partialScore = parsed.partialScore || migrateToPartialScore(parsed)
      const summaryScore = parsed.summaryScore || defaultSummaryScoreConfig

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
        partialScore,
        summaryScore,
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
export function getMarkImagePath(
  status: ScoringStatus,
  useTransparent: boolean
): string {
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
