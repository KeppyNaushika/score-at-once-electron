/**
 * 採点画面が使うユーザー設定の一覧と、保存文字列から画面用の値を組み立てる純粋関数。
 *
 * 取得と書き込みは呼び出し側（`ScoringMainView`）が行う。ここはキーもチャンネルも
 * 持たないので、React にも DB にも依存しない。
 */

import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { parsePreference } from "@/lib/userPreferences"
import { defineStringUnion } from "@/types/stringUnion"

/** クリック採点で選択可能なアクション */
const CLICK_SCORING_ACTIONS = [
  "none",
  "correct",
  "incorrect",
  "partial",
  "partial_modal",
  "pending",
  "unscored",
  "no_answer",
  "double_mark",
  "individual",
] as const

export type ClickScoringAction = (typeof CLICK_SCORING_ACTIONS)[number]

/** 保存値・入力値をアクションへ倒す。知らない値は「なし」に落とす */
export const { to: toClickScoringAction } = defineStringUnion(
  CLICK_SCORING_ACTIONS,
  "none"
)

/** クリック回数ごとのアクション設定 */
export interface ClickScoringConfig {
  2: ClickScoringAction
  3: ClickScoringAction
  4: ClickScoringAction
}

const DEFAULT_CLICK_SCORING_CONFIG: ClickScoringConfig = {
  2: "incorrect",
  3: "partial_modal",
  4: "individual",
}

/**
 * 保存文字列をアクション設定へ倒す。
 *
 * 保存済み JSON をそのまま広げると、壊れた値が ClickScoringAction を名乗ったまま
 * 通る（型は保存値の中身を知らない）。クリック回数ごとに1つずつ union へ倒す。
 */
export function toClickScoringConfig(
  stored: string | null
): ClickScoringConfig {
  if (!stored) return DEFAULT_CLICK_SCORING_CONFIG

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return DEFAULT_CLICK_SCORING_CONFIG
  }
  if (typeof parsed !== "object" || parsed === null) {
    return DEFAULT_CLICK_SCORING_CONFIG
  }

  const storedActions: Record<string, unknown> = { ...parsed }
  const actionOf = (clickCount: 2 | 3 | 4): ClickScoringAction => {
    const value = storedActions[String(clickCount)]
    if (typeof value !== "string")
      return DEFAULT_CLICK_SCORING_CONFIG[clickCount]
    return toClickScoringAction(value)
  }

  return { 2: actionOf(2), 3: actionOf(3), 4: actionOf(4) }
}

/** 採点画面が読む設定キー。並び順が `useQueries` の並びになる */
export const SCORING_PREFERENCE_KEYS = [
  "itemsPerLine",
  "autoScroll",
  "showStudentNames",
  "layoutDirection",
  "answerSortOrder",
  "expandMargin",
  "clickScoringConfig",
  "clickScoringDebounceMs",
  "masterAnswerDisplayMode",
  "masterAnswerOpacity",
  "masterAnswerKeyBehavior",
] as const satisfies readonly PreferenceKey[]

/**
 * 設定を書く口。**値は型のまま渡す**（保存文字列への変換は
 * `setUserPreferenceMutation` が持つ）。呼び出し側は `mutate` をそのまま渡す。
 */
type WritePreference = (
  input: {
    [TKey in PreferenceKey]: { key: TKey; value: PreferenceValueType[TKey] }
  }[PreferenceKey]
) => void

/**
 * 採点画面の設定と、その書き換え口を組み立てる。
 *
 * @param stored `SCORING_PREFERENCE_KEYS` と同じ並びの保存文字列
 * @param write 保存する口（1キー分）
 */
export function buildScoringSettings(
  stored: readonly (string | null)[],
  write: WritePreference
) {
  const rawOf = (key: (typeof SCORING_PREFERENCE_KEYS)[number]) =>
    stored[SCORING_PREFERENCE_KEYS.indexOf(key)] ?? null

  /**
   * 保存文字列は必ず `parsePreference` を通す。
   *
   * `serializePreference` が `"string?"` を JSON で1枚くるむので、生のまま読むと
   * 段数が食い違い、保存済みの値が丸ごと既定値へ落ちる（R1 #2 で実際に起きた）。
   */
  const valueOf = <TKey extends (typeof SCORING_PREFERENCE_KEYS)[number]>(
    key: TKey
  ) => parsePreference(key, rawOf(key))

  return {
    // 1行あたりの件数は配列で出し入れする（shadcn/Radix の Slider が配列を扱う）
    itemsPerLine: [valueOf("itemsPerLine")],
    autoScroll: valueOf("autoScroll"),
    showStudentNames: valueOf("showStudentNames"),
    layoutDirection: valueOf("layoutDirection"),
    answerSortOrder: valueOf("answerSortOrder"),
    expandMargin: valueOf("expandMargin"),
    clickScoringConfig: toClickScoringConfig(valueOf("clickScoringConfig")),
    clickScoringDebounceMs: valueOf("clickScoringDebounceMs"),
    masterAnswerDisplayMode: valueOf("masterAnswerDisplayMode"),
    masterAnswerOpacity: valueOf("masterAnswerOpacity"),
    masterAnswerKeyBehavior: valueOf("masterAnswerKeyBehavior"),

    // キーごとに書く。まとめる関数を挟むと、キーと値の対応が総称の中へ隠れて
    // 型が確かめられなくなる（union のどの枝かが決まらない）
    setItemsPerLine: (sliderValue: number[]) =>
      write({ key: "itemsPerLine", value: sliderValue[0] }),
    setAutoScroll: (value: PreferenceValueType["autoScroll"]) =>
      write({ key: "autoScroll", value }),
    setShowStudentNames: (value: PreferenceValueType["showStudentNames"]) =>
      write({ key: "showStudentNames", value }),
    setLayoutDirection: (value: PreferenceValueType["layoutDirection"]) =>
      write({ key: "layoutDirection", value }),
    setAnswerSortOrder: (value: PreferenceValueType["answerSortOrder"]) =>
      write({ key: "answerSortOrder", value }),
    setExpandMargin: (value: PreferenceValueType["expandMargin"]) =>
      write({ key: "expandMargin", value }),
    setClickAction: (clickCount: 2 | 3 | 4, action: ClickScoringAction) => {
      const next = {
        ...toClickScoringConfig(valueOf("clickScoringConfig")),
        [clickCount]: action,
      }
      write({ key: "clickScoringConfig", value: JSON.stringify(next) })
    },
    setClickScoringDebounceMs: (
      value: PreferenceValueType["clickScoringDebounceMs"]
    ) => write({ key: "clickScoringDebounceMs", value }),
    setMasterAnswerDisplayMode: (
      value: PreferenceValueType["masterAnswerDisplayMode"]
    ) => write({ key: "masterAnswerDisplayMode", value }),
    setMasterAnswerOpacity: (
      value: PreferenceValueType["masterAnswerOpacity"]
    ) => write({ key: "masterAnswerOpacity", value }),
    setMasterAnswerKeyBehavior: (
      value: PreferenceValueType["masterAnswerKeyBehavior"]
    ) => write({ key: "masterAnswerKeyBehavior", value }),
  }
}
