/**
 * @fileoverview 採点状態の表示色管理
 * @description 一括採点画面のPanel・一覧表示の背景色をカスタマイズ可能にする
 *
 * - 4つのプリセットパターン（標準、ビビッド、ソフト、色覚多様性対応）
 * - 各状態の個別カスタマイズ
 *
 * **ここにあるのは値と、保存文字列を読む計算だけ。** 読み書きは
 * `src/queries/settings.ts` の `userPreferenceQuery` / `setUserPreferenceMutation`
 * を通す（キー `scoringStatusColors` / `scoringColorPresetId`）。かつてはこの
 * ファイルが自前のキャッシュと `window` イベントで変更を配っていたが、設定画面と
 * 採点画面が同じキャッシュを見る形にすれば、その仕掛けは要らない。
 *
 * プリセットidは中身が id そのものなので、専用の読み手は持たない
 * （`parsePreference("scoringColorPresetId", …)` で足りる）。
 */

import type { ScoringStatus } from "@/types/scoringStatus.types"

import { parsePreference } from "./userPreferences"

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
export type ScoringStatusColors = Record<ScoringStatus, StatusColorConfig>

/** カラープリセット定義 */
interface ScoringColorPreset {
  id: string
  name: string
  description: string
  colors: ScoringStatusColors
}

/** 状態のラベル（日本語） */
export const SCORING_STATUS_LABELS: Record<ScoringStatus, string> = {
  unscored: "未採点",
  correct: "正答",
  partial: "部分点",
  pending: "保留",
  incorrect: "誤答",
  no_answer: "無答",
  double_mark: "Wマーク",
}

/** 状態の表示順序 */
export const SCORING_STATUS_ORDER: ScoringStatus[] = [
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

/** 既定の配色（プリセットの先頭） */
export const DEFAULT_SCORING_STATUS_COLORS: ScoringStatusColors =
  SCORING_COLOR_PRESETS[0].colors

/** JSON から読めたものが、名前で引ける入れ物か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** 保存されている1状態ぶんの色として読めるか */
function isStatusColorConfig(value: unknown): value is StatusColorConfig {
  if (!isRecord(value)) return false
  return (
    typeof value.bg === "string" &&
    typeof value.text === "string" &&
    typeof value.icon === "string"
  )
}

/**
 * 保存されている色設定を読める形に直す。
 *
 * 受け取るのは `UserPreference` の**生の保存文字列**で、剥がす段は2つある。
 * 1つ目は保存の符号化（`serializePreference` が文字列を JSON でくるむ）、
 * 2つ目が中身の JSON。ここが両方を持つことで、呼び出し側が段を数え違えない
 * （実際に片方を飛ばして、色が常に既定へ落ちていた）。
 *
 * **読めた状態だけを差し替える。** 保存された時点に無かった状態は既定のまま残す
 * （状態は後から増えている）。「全部入っている」と名乗って組むと、古い保存値を
 * 開いたときに `colors.double_mark.bg` が undefined になり、採点画面の描画で落ちる。
 *
 * 旧いキー `"ungraded"` は `"unscored"` として読む（保存し直しはしない。
 * 次に色を変えたときに現行のキーで書き直る）。
 */
export function parseScoringStatusColors(
  stored: string | null
): ScoringStatusColors {
  const json = parsePreference("scoringStatusColors", stored)
  if (!json) return DEFAULT_SCORING_STATUS_COLORS

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return DEFAULT_SCORING_STATUS_COLORS
  }
  if (!isRecord(parsed)) return DEFAULT_SCORING_STATUS_COLORS

  const colors = { ...DEFAULT_SCORING_STATUS_COLORS }
  for (const status of SCORING_STATUS_ORDER) {
    const value =
      parsed[status] ?? (status === "unscored" ? parsed.ungraded : undefined)
    if (isStatusColorConfig(value)) colors[status] = value
  }
  return colors
}
