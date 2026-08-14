/**
 * 採点画面が使うユーザー設定の一覧と、保存文字列から画面用の値を組み立てる純粋関数。
 *
 * 取得と書き込みは呼び出し側（`ScoringMainView`）が行う。ここはキーもチャンネルも
 * 持たないので、React にも DB にも依存しない。
 */

import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { parsePreference, serializePreference } from "@/lib/userPreferences"
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

/** 保存文字列を書き込む口。呼び出し側の `useMutation` を渡す */
type WritePreference = (input: { key: PreferenceKey; value: string }) => void

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
  const storedOf = (key: (typeof SCORING_PREFERENCE_KEYS)[number]) =>
    stored[SCORING_PREFERENCE_KEYS.indexOf(key)] ?? null

  const valueOf = <TKey extends (typeof SCORING_PREFERENCE_KEYS)[number]>(
    key: TKey
  ) => parsePreference(key, storedOf(key))

  const setter =
    <TKey extends (typeof SCORING_PREFERENCE_KEYS)[number]>(key: TKey) =>
    (value: PreferenceValueType[TKey]) =>
      write({ key, value: serializePreference(key, value) })

  const setClickScoringConfig = setter("clickScoringConfig")

  return {
    // 1行あたりの件数は配列で出し入れする（shadcn/Radix の Slider が配列を扱う）
    itemsPerLine: [valueOf("itemsPerLine")],
    autoScroll: valueOf("autoScroll"),
    showStudentNames: valueOf("showStudentNames"),
    layoutDirection: valueOf("layoutDirection"),
    answerSortOrder: valueOf("answerSortOrder"),
    expandMargin: valueOf("expandMargin"),
    clickScoringConfig: toClickScoringConfig(storedOf("clickScoringConfig")),
    clickScoringDebounceMs: valueOf("clickScoringDebounceMs"),
    masterAnswerDisplayMode: valueOf("masterAnswerDisplayMode"),
    masterAnswerOpacity: valueOf("masterAnswerOpacity"),
    masterAnswerKeyBehavior: valueOf("masterAnswerKeyBehavior"),

    setItemsPerLine: (sliderValue: number[]) =>
      setter("itemsPerLine")(sliderValue[0]),
    setAutoScroll: setter("autoScroll"),
    setShowStudentNames: setter("showStudentNames"),
    setLayoutDirection: setter("layoutDirection"),
    setAnswerSortOrder: setter("answerSortOrder"),
    setExpandMargin: setter("expandMargin"),
    setClickAction: (clickCount: 2 | 3 | 4, action: ClickScoringAction) => {
      const next = {
        ...toClickScoringConfig(storedOf("clickScoringConfig")),
        [clickCount]: action,
      }
      setClickScoringConfig(JSON.stringify(next))
    },
    setClickScoringDebounceMs: setter("clickScoringDebounceMs"),
    setMasterAnswerDisplayMode: setter("masterAnswerDisplayMode"),
    setMasterAnswerOpacity: setter("masterAnswerOpacity"),
    setMasterAnswerKeyBehavior: setter("masterAnswerKeyBehavior"),
  }
}
