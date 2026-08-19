/**
 * @fileoverview 採点状態の表示色管理
 * @description 一括採点画面のPanel・一覧表示の背景色をカスタマイズ可能にする
 *
 * - 4つのプリセットパターン（標準、ビビッド、ソフト、色覚多様性対応）
 * - 各状態の個別カスタマイズ
 *
 * **ここにあるのは値と、行を読む計算だけ。** 読み書きは `src/queries/settings.ts` の
 * `userScoringStatusColorsQuery` / `setUserScoringStatusColorMutation` を通す。
 * かつてはこのファイルが自前のキャッシュと `window` イベントで変更を配っていたが、
 * 設定画面と採点画面が同じキャッシュを見る形にすれば、その仕掛けは要らない。
 *
 * **色は状態ごとに1行**（`UserScoringStatusColor`）。1キーの JSON に7状態を畳んで
 * いた頃は、続けて2色変えると先の1色が消えていた。
 *
 * プリセットidは中身が id そのものなので `UserPreference` のまま
 * （`parsePreference("scoringColorPresetId", …)` で足りる）。
 */

import type { UserScoringStatusColor } from "@prisma/client"

import type { UserScoringStatusColorValues } from "@/electron-src/lib/prisma/userScoringStatusColor"
import type { ScoringStatus } from "@/types/scoringStatus.types"
import { isScoringStatus } from "@/types/scoringStatus.types"

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

/**
 * 行（DB の列）から、状態で引ける形へ畳む。
 *
 * **行が無い状態は既定のまま。** 状態は後から増えているので、「全部入っている」と
 * 名乗って組むと、古い保存内容では `colors.double_mark.bg` が undefined になり、
 * 採点画面の描画で落ちる。
 *
 * 畳んだ形はキャッシュに載せない（`useQuery` の `select` で作る）。載せると、色を
 * 1つ書いたときの取り直し先が畳んだ形になり、束ごと作り直すことになる。
 */
export function toScoringStatusColors(
  rows: UserScoringStatusColor[]
): ScoringStatusColors {
  const colors = { ...DEFAULT_SCORING_STATUS_COLORS }
  for (const row of rows) {
    // 知らない状態の行は**読み飛ばす**。未採点へ倒すと、無関係な行が未採点の色を
    // 塗り替えてしまう（状態が増減した後の DB で起こりうる）
    if (!isScoringStatus(row.status)) continue
    colors[row.status] = {
      bg: row.backgroundColor,
      text: row.textColor,
      icon: row.iconColor,
    }
  }
  return colors
}

/** 状態1つぶんの色を、DB の列の形へ */
export function toStatusColorValues(
  config: StatusColorConfig
): UserScoringStatusColorValues {
  return {
    backgroundColor: config.bg,
    textColor: config.text,
    iconColor: config.icon,
  }
}
