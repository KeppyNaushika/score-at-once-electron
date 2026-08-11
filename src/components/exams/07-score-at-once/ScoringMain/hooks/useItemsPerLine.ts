/**
 * @fileoverview 1行あたりの表示件数設定フック
 */

import { useCallback } from "react"

import { useUserPreference } from "@/hooks/useUserPreference"

/**
 * 採点グリッドの1行あたりの表示件数を永続化するフック。
 *
 * 値を配列で出し入れするのは、shadcn/Radix の Slider が配列を扱うため。
 */
export function useItemsPerLine() {
  const { value, setValue } = useUserPreference("itemsPerLine")

  const setItemsPerLine = useCallback(
    (sliderValue: number[]) => setValue(sliderValue[0]),
    [setValue]
  )

  return { itemsPerLine: [value], setItemsPerLine }
}
