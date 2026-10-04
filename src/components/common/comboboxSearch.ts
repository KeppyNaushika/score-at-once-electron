/**
 * Combobox と ComboboxCheckList が共有する絞り込み（cmdk に渡す filter と、選択肢に添える
 * 絞り込み用の語）
 */

import { useMemo } from "react"

import { normalizeForSearch } from "@/lib/searchText"

import type { ComboboxOption } from "./Combobox"

/**
 * cmdk の絞り込み。**value（= id）は見ない。** 既定の絞り込みは value も対象に
 * するので、id の文字列に打った文字が含まれるだけで無関係の選択肢が残ってしまう。
 *
 * 空白で区切った語をすべて含むものだけを残す（あいまい一致はしない。漢字の氏名で
 * 飛び飛びに一致すると、関係の無い生徒が大量に残る）。並び順を変えないよう、残す
 * ものは全部同じ点にする。
 */
export function filterByKeywords(
  _value: string,
  search: string,
  keywords?: string[]
): number {
  const haystack = keywords?.join(" ") ?? ""
  const searchTerms = normalizeForSearch(search).split(/\s+/).filter(Boolean)
  return searchTerms.every((searchTerm) => haystack.includes(searchTerm))
    ? 1
    : 0
}

/**
 * 選択肢に、絞り込みに使う形（`filterByKeywords` が見る keywords）を添える。
 *
 * 打つたびに全件の文字列を作り直さないよう、選択肢が変わったときだけ作る。
 */
export function useSearchableOptions<TOption extends ComboboxOption>(
  options: readonly TOption[]
) {
  return useMemo(
    () =>
      options.map((option) => {
        const searchText = [option.label, ...(option.keywords ?? [])].join(" ")
        const normalizedText = normalizeForSearch(searchText)
        return {
          option,
          // 「山田太郎」と続けて打っても「山田 太郎」に引っかかるよう、空白を抜いた形も持つ
          searchKeywords: [normalizedText, normalizedText.replace(/\s+/g, "")],
        }
      }),
    [options]
  )
}
