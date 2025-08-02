import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { RefObject, useEffect } from "react"

interface UseAutoScrollProps {
  selectedAnswers: Set<string>
  layoutDirection: LayoutDirection
  autoScroll: boolean
  gridRef: RefObject<HTMLDivElement | null>
}

export function useAutoScroll({
  selectedAnswers,
  layoutDirection,
  autoScroll,
  gridRef,
}: UseAutoScrollProps) {
  // 選択された答案を画面中央にスクロール（自動スクロール設定に基づく）
  useEffect(() => {
    if (autoScroll && selectedAnswers.size === 1 && gridRef.current) {
      const selectedId = Array.from(selectedAnswers)[0]
      const selectedElement = gridRef.current.querySelector(
        `[data-answer-id="${selectedId}"]`,
      ) as HTMLElement

      if (selectedElement) {
        // gridRef.current自体がスクロールコンテナ（overflow-auto）
        const container = gridRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = selectedElement.getBoundingClientRect()

        // 縦・横両方向のスクロール計算（すべてのレイアウトに対応）
        const scrollLeft =
          elementRect.left -
          containerRect.left +
          container.scrollLeft -
          container.clientWidth / 2 +
          elementRect.width / 2

        const scrollTop =
          elementRect.top -
          containerRect.top +
          container.scrollTop -
          container.clientHeight / 2 +
          elementRect.height / 2

        // 両方向に同時にスクロール
        container.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: "smooth",
        })
      }
    }
  }, [selectedAnswers, layoutDirection, autoScroll, gridRef])
}
