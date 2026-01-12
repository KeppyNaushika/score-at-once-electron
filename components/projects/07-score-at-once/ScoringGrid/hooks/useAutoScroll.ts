import { RefObject, useCallback, useEffect, useMemo,useRef } from "react"

interface UseAutoScrollProps {
  selectedAnswers: Set<string>
  autoScroll: boolean
  containerRef: RefObject<HTMLDivElement | null>
}

export function useAutoScroll({
  selectedAnswers,
  autoScroll,
  containerRef,
}: UseAutoScrollProps) {
  const selectedAnswerId = useMemo(() => {
    if (!autoScroll || selectedAnswers.size !== 1) {
      return null
    }
    return Array.from(selectedAnswers)[0]
  }, [autoScroll, selectedAnswers])

  const previousTargetRef = useRef<{ x: number; y: number } | null>(null)

  const scrollElementIntoView = useCallback(
    (element: HTMLElement, force: boolean = false) => {
      if (!autoScroll || !containerRef.current) return

      const container = containerRef.current

      const containerRect = container.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()

      const targetX =
        elementRect.left -
        containerRect.left +
        container.scrollLeft -
        container.clientWidth / 2 +
        elementRect.width / 2

      const targetY =
        elementRect.top -
        containerRect.top +
        container.scrollTop -
        container.clientHeight / 2 +
        elementRect.height / 2

      const target = {
        x: Math.max(0, targetX),
        y: Math.max(0, targetY),
      }

      const prevTarget = previousTargetRef.current
      if (
        !force &&
        prevTarget &&
        Math.abs(prevTarget.x - target.x) < 1 &&
        Math.abs(prevTarget.y - target.y) < 1
      ) {
        return
      }

      previousTargetRef.current = target
      // ネイティブのスムーズスクロールを使用
      container.scrollTo({
        left: target.x,
        top: target.y,
        behavior: "smooth",
      })
    },
    [autoScroll, containerRef]
  )

  // 選択された答案を画面中央にスクロール（自動スクロール設定に基づく）
  useEffect(() => {
    if (!autoScroll || !selectedAnswerId || !containerRef.current) {
      return
    }

    const container = containerRef.current
    const selectedElement = container.querySelector(
      `[data-answer-id="${selectedAnswerId}"]`
    ) as HTMLElement | null

    if (!selectedElement) {
      return
    }

    scrollElementIntoView(selectedElement, false)
  }, [autoScroll, containerRef, selectedAnswerId, scrollElementIntoView])

  useEffect(() => {
    const handler = (event: Event) => {
      if (!autoScroll || !containerRef.current) {
        return
      }

      const customEvent = event as CustomEvent<{ answerId?: string }>
      const answerId = customEvent.detail?.answerId
      if (!answerId) return

      const container = containerRef.current
      const element = container.querySelector(
        `[data-answer-id="${answerId}"]`
      ) as HTMLElement | null

      if (!element) return

      scrollElementIntoView(element, true)
    }

    window.addEventListener("score-view:scroll-to-answer", handler)
    return () => {
      window.removeEventListener("score-view:scroll-to-answer", handler)
    }
  }, [autoScroll, containerRef, scrollElementIntoView])
}
