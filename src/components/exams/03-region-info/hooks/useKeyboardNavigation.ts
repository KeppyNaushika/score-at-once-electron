import { useRef } from "react"

import type { CropRegionRow } from "@/queries/cropRegion"

type UseKeyboardNavigationProps = {
  /** 表に出ている採点領域（表示順。隣の行を引くのに使う） */
  regions: CropRegionRow[]
}

/** 行内を左右に移る順序（Tab の行き先） */
const FIELD_ORDER = ["label", "points"]

/**
 * 領域情報テーブルの Enter/Tab キーによるセル間移動を管理するフック。
 *
 * **入力欄は採点領域の id で引く**（`data-row`）。添字で引くと、打鍵のたびに走る
 * 取り直しで並びが変わったとき、隣の行の欄へ飛ぶ。
 */
export const useKeyboardNavigation = ({
  regions,
}: UseKeyboardNavigationProps) => {
  const isComposingRef = useRef(false)

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = () => {
    isComposingRef.current = false
  }

  /** その欄へ移る。欄が無い（配点を持たない種類など）なら何もせず false */
  const focusField = (cropRegionId: string, fieldName: string): boolean => {
    const input = document.querySelector<HTMLInputElement>(
      `[data-row="${cropRegionId}"][data-field="${fieldName}"]`
    )
    if (!input || input.disabled) return false
    input.focus()
    input.select()
    return true
  }

  /** 表示順で隣の採点領域（端なら null） */
  const neighborCropRegionId = (
    cropRegionId: string,
    offset: number
  ): string | null => {
    const currentIndex = regions.findIndex(
      (region) => region.id === cropRegionId
    )
    if (currentIndex === -1) return null
    return regions[currentIndex + offset]?.id ?? null
  }

  const handleKeyDown = (
    e: React.KeyboardEvent,
    cropRegionId: string,
    fieldName: string
  ) => {
    // IME入力中はEnterキーとTabキーでの移動をスキップ
    if ((e.key === "Enter" || e.key === "Tab") && isComposingRef.current) {
      return
    }

    const fieldIndex = FIELD_ORDER.indexOf(fieldName)

    if (e.key === "Enter") {
      e.preventDefault()
      // 同じ欄のまま、次（Shift なら前）の行へ
      const targetCropRegionId = neighborCropRegionId(
        cropRegionId,
        e.shiftKey ? -1 : 1
      )
      if (targetCropRegionId) focusField(targetCropRegionId, fieldName)
      return
    }

    if (e.key !== "Tab") return

    e.preventDefault()
    if (!e.shiftKey) {
      // 同じ行の次の欄へ。行の端なら次の行の先頭の欄へ
      const nextField = FIELD_ORDER[fieldIndex + 1]
      if (nextField && focusField(cropRegionId, nextField)) return

      const nextCropRegionId = neighborCropRegionId(cropRegionId, 1)
      if (nextCropRegionId) focusField(nextCropRegionId, FIELD_ORDER[0])
      return
    }

    // 同じ行の前の欄へ。行の先頭なら前の行の末尾の欄へ
    const previousField = FIELD_ORDER[fieldIndex - 1]
    if (previousField && focusField(cropRegionId, previousField)) return

    const previousCropRegionId = neighborCropRegionId(cropRegionId, -1)
    if (!previousCropRegionId) return
    // 配点を持たない種類の行では欄が無いので、ラベルへ落とす
    if (!focusField(previousCropRegionId, "points")) {
      focusField(previousCropRegionId, "label")
    }
  }

  return {
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
