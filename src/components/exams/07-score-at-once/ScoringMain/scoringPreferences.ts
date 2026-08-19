/**
 * 採点画面が使うユーザー設定の一覧と、保存文字列から画面用の値を組み立てる純粋関数。
 *
 * 取得と書き込みは呼び出し側（`ScoringMainView`）が行う。ここはキーもチャンネルも
 * 持たないので、React にも DB にも依存しない。
 *
 * **1つの値で足りる設定だけがここにある。** 組が繰り返す設定（クリック回数ごとの動作・
 * 採点状態ごとの色・側面パネルの節）は行で持つので、`src/queries/settings.ts` の
 * それぞれの口から読む。
 */

import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { parsePreference } from "@/lib/userPreferences"

/** 採点画面が読む設定キー。並び順が `useQueries` の並びになる */
export const SCORING_PREFERENCE_KEYS = [
  "itemsPerLine",
  "autoScroll",
  "showStudentNames",
  "layoutDirection",
  "answerSortOrder",
  "expandMargin",
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
