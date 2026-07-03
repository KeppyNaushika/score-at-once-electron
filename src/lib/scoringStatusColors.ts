/**
 * @fileoverview 採点状態の表示色管理
 * @description 一括採点画面のPanel・一覧表示の背景色をカスタマイズ可能にする
 *
 * - 4つのプリセットパターン（標準、ビビッド、ソフト、色覚多様性対応）
 * - 各状態の個別カスタマイズ
 * - DBに保存（UserPreference KV方式）
 */

/** 採点状態の種類（ScoringStatusと統一） */
export type ScoringStatusType =
  | "unscored"
  | "correct"
  | "partial"
  | "pending"
  | "incorrect"
  | "no_answer"
  | "double_mark"

/** 各状態の色設定 */
export interface StatusColorConfig {
  /** 背景色（HEX） */
  bg: string
  /** テキスト色（HEX） */
  text: string
  /** アイコン色（HEX） */
  icon: string
}

/** 全状態の色設定 */
export type ScoringStatusColors = Record<ScoringStatusType, StatusColorConfig>

/** カラープリセット定義 */
export interface ScoringColorPreset {
  id: string
  name: string
  description: string
  colors: ScoringStatusColors
}

/** 状態のラベル（日本語） */
export const SCORING_STATUS_LABELS: Record<ScoringStatusType, string> = {
  unscored: "未採点",
  correct: "正答",
  partial: "部分点",
  pending: "保留",
  incorrect: "誤答",
  no_answer: "無答",
  double_mark: "Wマーク",
}

/** 状態の表示順序 */
export const SCORING_STATUS_ORDER: ScoringStatusType[] = [
  "unscored",
  "correct",
  "partial",
  "pending",
  "incorrect",
  "no_answer",
  "double_mark",
]

/**
 * プリセット定義
 */
export const SCORING_COLOR_PRESETS: ScoringColorPreset[] = [
  {
    id: "default",
    name: "標準",
    description: "デフォルトの配色",
    colors: {
      unscored: { bg: "#F9FAFB", text: "#4B5563", icon: "#9CA3AF" },
      correct: { bg: "#DCFCE7", text: "#166534", icon: "#16A34A" },
      partial: { bg: "#FEF9C3", text: "#854D0E", icon: "#CA8A04" },
      pending: { bg: "#DBEAFE", text: "#1E40AF", icon: "#2563EB" },
      incorrect: { bg: "#FEE2E2", text: "#991B1B", icon: "#DC2626" },
      no_answer: { bg: "#EDE9FE", text: "#5B21B6", icon: "#7C3AED" },
      double_mark: { bg: "#FFF7ED", text: "#9A3412", icon: "#EA580C" },
    },
  },
  {
    id: "vivid",
    name: "ビビッド",
    description: "より鮮やかな配色",
    colors: {
      unscored: { bg: "#E5E7EB", text: "#374151", icon: "#6B7280" },
      correct: { bg: "#BBF7D0", text: "#14532D", icon: "#22C55E" },
      partial: { bg: "#FDE047", text: "#713F12", icon: "#EAB308" },
      pending: { bg: "#93C5FD", text: "#1E3A8A", icon: "#3B82F6" },
      incorrect: { bg: "#FECACA", text: "#7F1D1D", icon: "#EF4444" },
      no_answer: { bg: "#DDD6FE", text: "#4C1D95", icon: "#8B5CF6" },
      double_mark: { bg: "#FFEDD5", text: "#7C2D12", icon: "#F97316" },
    },
  },
  {
    id: "soft",
    name: "ソフト",
    description: "淡い配色で目に優しい",
    colors: {
      unscored: { bg: "#FAFAFA", text: "#737373", icon: "#A3A3A3" },
      correct: { bg: "#ECFCCB", text: "#365314", icon: "#84CC16" },
      partial: { bg: "#FEF3C7", text: "#92400E", icon: "#D97706" },
      pending: { bg: "#E0F2FE", text: "#075985", icon: "#0EA5E9" },
      incorrect: { bg: "#FFE4E6", text: "#9F1239", icon: "#F43F5E" },
      no_answer: { bg: "#F3E8FF", text: "#6B21A8", icon: "#A855F7" },
      double_mark: { bg: "#FEF3C7", text: "#78350F", icon: "#D97706" },
    },
  },
  {
    id: "colorblind",
    name: "色覚多様性対応",
    description: "Wong配色パレット準拠",
    colors: {
      unscored: { bg: "#E8E8E8", text: "#4D4D4D", icon: "#999999" },
      correct: { bg: "#C8EDE0", text: "#005C45", icon: "#009E73" },
      partial: { bg: "#FCF6C8", text: "#6B5A00", icon: "#F0E442" },
      pending: { bg: "#D0EBFA", text: "#0066A0", icon: "#56B4E9" },
      incorrect: { bg: "#FADDC8", text: "#8B3A00", icon: "#D55E00" },
      no_answer: { bg: "#F5E0EC", text: "#7A3F66", icon: "#CC79A7" },
      double_mark: { bg: "#FAE8D0", text: "#8B4513", icon: "#E69F00" },
    },
  },
]

/** メモリキャッシュ（同期的なアクセス用） */
let cachedColors: ScoringStatusColors = SCORING_COLOR_PRESETS[0].colors
/** 現在選択中のプリセットID */
let cachedPresetId: string | null = "default"
/** 現在のユーザーID（保存時に使用） */
let currentUserId: string | null = null

/**
 * DBのJSON内の旧キー"ungraded"を"unscored"にマイグレーション
 */
function migrateUngradedKey(
  colors: Record<string, StatusColorConfig>
): ScoringStatusColors {
  const result = { ...colors } as Record<string, StatusColorConfig>
  if ("ungraded" in result && !("unscored" in result)) {
    result.unscored = result.ungraded
    delete result.ungraded
  }
  return result as ScoringStatusColors
}

/**
 * DBから採点状態色を読み込み（初期化用・KV方式）
 */
export async function loadScoringStatusColors(userId: string): Promise<void> {
  if (typeof window === "undefined" || !window.electronAPI?.settings) return

  try {
    currentUserId = userId
    const [colorsResult, presetIdResult] = await Promise.all([
      window.electronAPI.settings.getUserPreference(
        userId,
        "scoringStatusColors"
      ),
      window.electronAPI.settings.getUserPreference(
        userId,
        "scoringColorPresetId"
      ),
    ])

    if (
      colorsResult.success &&
      colorsResult.value &&
      colorsResult.value !== "null"
    ) {
      try {
        const parsed: unknown = JSON.parse(colorsResult.value)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          cachedColors = migrateUngradedKey(
            parsed as Record<string, StatusColorConfig>
          )
        }
      } catch {
        // keep default
      }
    }

    if (
      presetIdResult.success &&
      presetIdResult.value &&
      presetIdResult.value !== "null"
    ) {
      let parsed = presetIdResult.value
      try {
        parsed = JSON.parse(presetIdResult.value)
      } catch {
        // keep raw value
      }
      cachedPresetId = parsed
    } else {
      cachedPresetId = null
    }
  } catch (error) {
    console.error("Failed to load scoring status colors:", error)
  }
}

/**
 * 保存されている採点状態色を取得（同期的）
 */
export function getScoringStatusColors(): ScoringStatusColors {
  return cachedColors
}

/**
 * 採点状態色を保存（KV方式・楽観的更新）
 */
export async function saveScoringStatusColors(
  colors: ScoringStatusColors,
  userId?: string
): Promise<void> {
  const targetUserId = userId || currentUserId
  cachedColors = colors
  cachedPresetId = null

  if (typeof window === "undefined") return

  // 変更を通知
  window.dispatchEvent(new CustomEvent("scoringStatusColorsChanged"))

  if (!targetUserId || !window.electronAPI?.settings) return

  try {
    await Promise.all([
      window.electronAPI.settings.setUserPreference(
        targetUserId,
        "scoringStatusColors",
        JSON.stringify(colors)
      ),
      window.electronAPI.settings.setUserPreference(
        targetUserId,
        "scoringColorPresetId",
        "null"
      ),
    ])
  } catch (error) {
    console.error("Failed to save scoring status colors:", error)
  }
}

/**
 * 現在選択されているプリセットIDを取得
 */
export function getCurrentPresetId(): string | null {
  return cachedPresetId
}

/**
 * プリセットを適用（KV方式・楽観的更新）
 */
export async function applyScoringColorPreset(
  presetId: string,
  userId?: string
): Promise<void> {
  const preset = SCORING_COLOR_PRESETS.find(
    (candidate) => candidate.id === presetId
  )
  if (!preset) {
    console.error(`Preset not found: ${presetId}`)
    return
  }

  const targetUserId = userId || currentUserId
  cachedColors = preset.colors
  cachedPresetId = presetId

  if (typeof window === "undefined") return

  // 変更を通知
  window.dispatchEvent(new CustomEvent("scoringStatusColorsChanged"))

  if (!targetUserId || !window.electronAPI?.settings) return

  try {
    await Promise.all([
      window.electronAPI.settings.setUserPreference(
        targetUserId,
        "scoringStatusColors",
        JSON.stringify(preset.colors)
      ),
      window.electronAPI.settings.setUserPreference(
        targetUserId,
        "scoringColorPresetId",
        JSON.stringify(presetId)
      ),
    ])
  } catch (error) {
    console.error("Failed to apply scoring color preset:", error)
  }
}
