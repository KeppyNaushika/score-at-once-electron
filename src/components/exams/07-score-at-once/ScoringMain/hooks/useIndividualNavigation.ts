import { useCallback } from "react"

import type { LayoutDirection } from "@/components/exams/07-score-at-once/types"

interface UseIndividualNavigationOptions {
  layoutDirection: LayoutDirection
  handleIndividualNextStudent: () => void
  handleIndividualPrevStudent: () => void
}

/** 個別表示で、並べる向きに合わせて WASD・矢印キーを次／前の生徒へ読み替える */
export function useIndividualNavigation({
  layoutDirection,
  handleIndividualNextStudent,
  handleIndividualPrevStudent,
}: UseIndividualNavigationOptions) {
  /**
   * 個別モード用ナビゲーション
   * レイアウト方向に応じてWASD/矢印キーを次/前の生徒に変換
   */
  const handleIndividualNavigation = useCallback(
    (key: string) => {
      // レイアウト方向ごとに「次の生徒」方向のキーを判定
      let isNext = false
      let isPrev = false

      switch (layoutDirection) {
        case "right-down":
          // 右→下: d/s/ArrowDown = next, a/w/ArrowUp = prev
          isNext = key === "d" || key === "s" || key === "ArrowDown"
          isPrev = key === "a" || key === "w" || key === "ArrowUp"
          break
        case "left-down":
          // 左→下: a/s/ArrowDown = next, d/w/ArrowUp = prev
          isNext = key === "a" || key === "s" || key === "ArrowDown"
          isPrev = key === "d" || key === "w" || key === "ArrowUp"
          break
        case "down-right":
          // 下→右: s/d/ArrowDown = next, w/a/ArrowUp = prev
          isNext = key === "s" || key === "d" || key === "ArrowDown"
          isPrev = key === "w" || key === "a" || key === "ArrowUp"
          break
        case "down-left":
          // 下→左: s/a/ArrowDown = next, w/d/ArrowUp = prev
          isNext = key === "s" || key === "a" || key === "ArrowDown"
          isPrev = key === "w" || key === "d" || key === "ArrowUp"
          break
      }

      if (isNext) {
        handleIndividualNextStudent()
      } else if (isPrev) {
        handleIndividualPrevStudent()
      }
    },
    [layoutDirection, handleIndividualNextStudent, handleIndividualPrevStudent]
  )

  return handleIndividualNavigation
}
