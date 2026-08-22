/**
 * @fileoverview ユーザー設定のKVスキーマ定義と型安全アクセス
 * @description UserPreference KVテーブルの設定キー・デフォルト値・型パースを一元管理
 *
 * **ここに置くのは、1つの値で足りる設定だけ。** 組が繰り返すもの（採点状態ごとの色・
 * クリック回数ごとの動作・側面パネルの節ごとの開閉）は行で持つ
 * （`UserScoringStatusColor` / `UserClickScoringAction` / `UserSidePanelSection`）。
 * 塊で読み書きすると、**続けて2つ変えたときに先の1つが消える** — 取り直しが着地する
 * 前に、古い写しへ2度目を重ねて書くため。
 */

import type { RenderMode } from "@/types/answerSheetDefinition.types"
import { RENDER_MODES } from "@/types/answerSheetDefinition.types"

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
/** 区分の画面を開いたときに、サイドバーをどうするか */
export const SIDEBAR_BEHAVIORS = ["collapse", "expand", "none"] as const
/** 採点画面の操作モード（キーボード操作／マウス操作） */
export const SCORING_OPERATION_MODES = ["keyboard", "mouse"] as const

/** 一覧に含まれるかを、要素の型を保ったまま判定する */
export const isOneOf = <TValue extends string>(
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
  clickScoringDebounceMs: { type: "number" as const, default: 300 },
  /**
   * 離席時の目隠し（簡易スクリーンセイバー）。
   *
   * 端末ではなく利用者に付く設定なので、他の端末で入り直しても同じように働く。
   */
  screenBlackoutEnabled: { type: "boolean" as const, default: false },
  screenBlackoutTimeoutMinutes: { type: "number" as const, default: 5 },
  screenBlackoutAutoFullScreen: { type: "boolean" as const, default: false },
  /**
   * 解答用紙をどちらの姿で見るか（解答用紙／模範解答）。
   *
   * **解答用紙1枚ごとの設定ではない。** 「模範解答を見ながら作る」は作っている人の
   * 都合で、解答用紙が持つ性質ではないので、利用者に付ける。
   */
  asbRenderMode: {
    type: "string" as const,
    default: "answer-sheet",
    validate: (value: string) => isOneOf(RENDER_MODES, value),
  },
  /** 解答用紙の書き出しで、解答用紙と模範解答を別のファイルにするか */
  asbExportSeparateFiles: { type: "boolean" as const, default: true },
  /**
   * 区分の画面を開いたときのサイドバーの動作。**区分ごとに1つの値**なので行では
   * なくここに置く（区分は `SIDEBAR_SECTIONS` が持つ固定の4つで、増減しない）。
   *
   * 端末ではなく利用者に付く設定。画面消灯と同じタブに並びながら、ここだけが
   * `localStorage` に残っていたのを寄せた（段階55）。
   */
  sidebarBehaviorExams: {
    type: "string" as const,
    default: "none",
    validate: (value: string) => isOneOf(SIDEBAR_BEHAVIORS, value),
  },
  sidebarBehaviorAnswerSheetBuilder: {
    type: "string" as const,
    default: "none",
    validate: (value: string) => isOneOf(SIDEBAR_BEHAVIORS, value),
  },
  sidebarBehaviorPdfTools: {
    type: "string" as const,
    default: "none",
    validate: (value: string) => isOneOf(SIDEBAR_BEHAVIORS, value),
  },
  sidebarBehaviorGrades: {
    type: "string" as const,
    default: "none",
    validate: (value: string) => isOneOf(SIDEBAR_BEHAVIORS, value),
  },
  /**
   * 採点画面の操作モードと、それを憶えるかどうか。
   *
   * **憶えないときは既定へ戻す**（`scoringOperationModeRemembered` が false）。
   * 憶えていない間はモードの行を見ないので、次に採点画面へ入れば選択が出る。
   */
  scoringOperationMode: {
    type: "string" as const,
    default: "keyboard",
    validate: (value: string) => isOneOf(SCORING_OPERATION_MODES, value),
  },
  scoringOperationModeRemembered: {
    type: "boolean" as const,
    default: false,
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
  scoringColorPresetId: string | null
  masterAnswerDisplayMode: (typeof MASTER_ANSWER_DISPLAY_MODES)[number]
  masterAnswerOpacity: number
  masterAnswerKeyBehavior: (typeof MASTER_ANSWER_KEY_BEHAVIORS)[number]
  clickScoringDebounceMs: number
  screenBlackoutEnabled: boolean
  screenBlackoutTimeoutMinutes: number
  screenBlackoutAutoFullScreen: boolean
  asbRenderMode: RenderMode
  asbExportSeparateFiles: boolean
  sidebarBehaviorExams: (typeof SIDEBAR_BEHAVIORS)[number]
  sidebarBehaviorAnswerSheetBuilder: (typeof SIDEBAR_BEHAVIORS)[number]
  sidebarBehaviorPdfTools: (typeof SIDEBAR_BEHAVIORS)[number]
  sidebarBehaviorGrades: (typeof SIDEBAR_BEHAVIORS)[number]
  scoringOperationMode: (typeof SCORING_OPERATION_MODES)[number]
  scoringOperationModeRemembered: boolean
}

/**
 * 保存文字列から中身の文字列を取り出す。
 *
 * 現行は `serializePreference` が JSON で1枚くるむ。**古い保存値はくるまれて
 * いない**ので、JSON として読めなければ生のまま返す（`#FF0000` など）。
 *
 * 落とし穴は「古い生の値が、たまたま JSON として読めてしまう」場合である。中身自体が
 * JSON だった設定（採点状態の色・クリック採点。いずれも行へ割った）では、素朴に
 * `JSON.parse` するとオブジェクトが返り、文字列を名乗ったまま呼び出し側へ渡って設定が
 * 丸ごと既定値へ落ちていた。**文字列になったときだけ剥がす。**
 */
function unwrapStoredString(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === "string" ? parsed : raw
  } catch {
    return raw
  }
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
        const parsed = unwrapStoredString(raw)
        const validate = (schema as { validate?: (value: string) => boolean })
          .validate
        if (validate && !validate(parsed)) {
          return schema.default as PreferenceValueType[K]
        }
        return parsed as PreferenceValueType[K]
      }
      case "string?": {
        if (raw === "null") return null as PreferenceValueType[K]
        return unwrapStoredString(raw) as PreferenceValueType[K]
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
