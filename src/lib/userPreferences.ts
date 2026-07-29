/**
 * @fileoverview ユーザー設定のKVスキーマ定義と型安全アクセス
 * @description UserPreference KVテーブルの設定キー・デフォルト値・型パースを一元管理
 */

/** 設定キーごとのスキーマ定義 */
export const USER_PREFERENCE_SCHEMA = {
  showStudentNames: { type: "boolean" as const, default: true },
  autoScroll: { type: "boolean" as const, default: true },
  itemsPerLine: { type: "number" as const, default: 5 },
  layoutDirection: {
    type: "string" as const,
    default: "right-down",
    validate: (v: string) =>
      ["right-down", "left-down", "down-right", "down-left"].includes(v),
  },
  answerSortOrder: {
    type: "string" as const,
    default: "custom",
    validate: (v: string) => ["custom", "whiteness", "darkness"].includes(v),
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
    validate: (v: string) =>
      ["off", "overlay", "split-horizontal", "split-vertical"].includes(v),
  },
  masterAnswerOpacity: { type: "number" as const, default: 50 },
  masterAnswerKeyBehavior: {
    type: "string" as const,
    default: "toggle",
    validate: (v: string) => ["toggle", "hold-to-show"].includes(v),
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
type PreferenceKey = keyof typeof USER_PREFERENCE_SCHEMA

/** 各キーのランタイム型マッピング */
type PreferenceValueType = {
  showStudentNames: boolean
  autoScroll: boolean
  itemsPerLine: number
  layoutDirection: string
  answerSortOrder: string
  expandMargin: number
  selectionBorderColor: string | null
  scoringStatusColors: string | null
  scoringColorPresetId: string | null
  masterAnswerDisplayMode: string
  masterAnswerOpacity: number
  masterAnswerKeyBehavior: string
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
