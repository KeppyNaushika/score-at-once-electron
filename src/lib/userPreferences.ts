/**
 * @fileoverview ユーザー設定のKVスキーマ定義と型安全アクセス
 * @description UserPreference KVテーブルの設定キー・デフォルト値・型パースを一元管理
 */

/**
 * union を持つ設定の取りうる値。
 *
 * 型の実体をここに置き、利用側（07 採点画面の `LayoutDirection` 等）はここから導く。
 * 検証の一覧と型が同じ配列を指すので、片方だけ増えることが起きない。
 */
export const LAYOUT_DIRECTIONS = [
  "right-down",
  "left-down",
  "down-right",
  "down-left",
] as const
export const ANSWER_SORT_ORDERS = ["custom", "whiteness", "darkness"] as const
export const MASTER_ANSWER_DISPLAY_MODES = [
  "off",
  "overlay",
  "split-horizontal",
  "split-vertical",
] as const
export const MASTER_ANSWER_KEY_BEHAVIORS = ["toggle", "hold-to-show"] as const

/** 一覧に含まれるかを、要素の型を保ったまま判定する */
const isOneOf = <TValue extends string>(
  candidates: readonly TValue[],
  value: string
): value is TValue => candidates.some((candidate) => candidate === value)

/** 設定キーごとのスキーマ定義 */
const USER_PREFERENCE_SCHEMA = {
  showStudentNames: { type: "boolean" as const, default: true },
  autoScroll: { type: "boolean" as const, default: true },
  itemsPerLine: { type: "number" as const, default: 5 },
  layoutDirection: {
    type: "string" as const,
    default: "right-down",
    validate: (value: string) => isOneOf(LAYOUT_DIRECTIONS, value),
  },
  answerSortOrder: {
    type: "string" as const,
    default: "custom",
    validate: (value: string) => isOneOf(ANSWER_SORT_ORDERS, value),
  },
  expandMargin: { type: "number" as const, default: 0 },
  selectionBorderColor: {
    type: "string?" as const,
    default: null as string | null,
  },
  scoringStatusColors: {
    type: "string?" as const,
    default: null as string | null,
  },
  scoringColorPresetId: {
    type: "string?" as const,
    default: null as string | null,
  },
  masterAnswerDisplayMode: {
    type: "string" as const,
    default: "off",
    validate: (value: string) => isOneOf(MASTER_ANSWER_DISPLAY_MODES, value),
  },
  masterAnswerOpacity: { type: "number" as const, default: 50 },
  masterAnswerKeyBehavior: {
    type: "string" as const,
    default: "toggle",
    validate: (value: string) => isOneOf(MASTER_ANSWER_KEY_BEHAVIORS, value),
  },
  clickScoringConfig: {
    type: "string?" as const,
    default: null as string | null,
  },
  clickScoringDebounceMs: { type: "number" as const, default: 300 },
  sidePanelCollapsedSections: {
    type: "string?" as const,
    default: null as string | null,
  },
} as const

/** 設定キーの型 */
export type PreferenceKey = keyof typeof USER_PREFERENCE_SCHEMA

/** 各キーのランタイム型マッピング */
export type PreferenceValueType = {
  showStudentNames: boolean
  autoScroll: boolean
  itemsPerLine: number
  layoutDirection: (typeof LAYOUT_DIRECTIONS)[number]
  answerSortOrder: (typeof ANSWER_SORT_ORDERS)[number]
  expandMargin: number
  selectionBorderColor: string | null
  scoringStatusColors: string | null
  scoringColorPresetId: string | null
  masterAnswerDisplayMode: (typeof MASTER_ANSWER_DISPLAY_MODES)[number]
  masterAnswerOpacity: number
  masterAnswerKeyBehavior: (typeof MASTER_ANSWER_KEY_BEHAVIORS)[number]
  clickScoringConfig: string | null
  clickScoringDebounceMs: number
  sidePanelCollapsedSections: string | null
}

/**
 * DB文字列値をパースして適切な型に変換
 */
export function parsePreference<K extends PreferenceKey>(
  key: K,
  raw: string | null
): PreferenceValueType[K] {
  const schema = USER_PREFERENCE_SCHEMA[key]

  if (raw === null || raw === undefined) {
    return schema.default as PreferenceValueType[K]
  }

  try {
    switch (schema.type) {
      case "boolean":
        return (raw === "true") as PreferenceValueType[K]
      case "number": {
        const parsedNumber = Number(raw)
        return (
          isNaN(parsedNumber) ? schema.default : parsedNumber
        ) as PreferenceValueType[K]
      }
      case "string": {
        // JSON文字列 → パースしてバリデーション
        let parsed: string
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = raw
        }
        const validate = (schema as { validate?: (v: string) => boolean })
          .validate
        if (validate && !validate(parsed)) {
          return schema.default as PreferenceValueType[K]
        }
        return parsed as PreferenceValueType[K]
      }
      case "string?": {
        if (raw === "null") return null as PreferenceValueType[K]
        try {
          return JSON.parse(raw) as PreferenceValueType[K]
        } catch {
          return raw as PreferenceValueType[K]
        }
      }
    }
  } catch {
    // Fallback to default on parse error
    return USER_PREFERENCE_SCHEMA[key].default as PreferenceValueType[K]
  }
}

/**
 * 値をDB保存用文字列にシリアライズ
 */
export function serializePreference<K extends PreferenceKey>(
  key: K,
  value: PreferenceValueType[K]
): string {
  const schema = USER_PREFERENCE_SCHEMA[key]

  switch (schema.type) {
    case "boolean":
      return String(value)
    case "number":
      return String(value)
    case "string":
      return JSON.stringify(value)
    case "string?":
      return value === null ? "null" : JSON.stringify(value)
  }
  // Fallback (should be unreachable)
  return String(value)
}
