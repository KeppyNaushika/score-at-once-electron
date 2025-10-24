import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { RefObject, useEffect, useRef, useCallback, useMemo } from "react"

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

interface UseAutoScrollProps {
  selectedAnswers: Set<string>
  layoutDirection: LayoutDirection
  autoScroll: boolean
  containerRef: RefObject<HTMLDivElement | null>
}

export function useAutoScroll({
  selectedAnswers,
  layoutDirection,
  autoScroll,
  containerRef,
}: UseAutoScrollProps) {

  const selectedAnswerId = useMemo(() => {
    if (!autoScroll || selectedAnswers.size !== 1) {
      return null
    }
    return Array.from(selectedAnswers)[0]
  }, [autoScroll, selectedAnswers])
  const animationRef = useRef<number | null>(null)
  const animationStateRef = useRef<{
    startTime: number
    duration: number
    startX: number
    startY: number
    targetX: number
    targetY: number
  } | null>(null)
  const previousTargetRef = useRef<{ x: number; y: number } | null>(null)

  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    animationStateRef.current = null
  }, [])

  const startAnimation = useCallback(
    (container: HTMLElement, targetX: number, targetY: number) => {
      const now = performance.now()
      const duration = 350 // ms

      const startX = container.scrollLeft
      const startY = container.scrollTop

    animationStateRef.current = {
      startTime: now,
      duration,
      startX,
      startY,
      targetX,
      targetY,
    }

    const step = () => {
      const state = animationStateRef.current
      if (!state) return

      const elapsed = performance.now() - state.startTime
      const progress = Math.min(elapsed / state.duration, 1)
      const eased = easeOutCubic(progress)

      const nextX = state.startX + (state.targetX - state.startX) * eased
      const nextY = state.startY + (state.targetY - state.startY) * eased

      container.scrollTo(nextX, nextY)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step)
      } else {
        cancelAnimation()
      }
      }

      cancelAnimation()
      animationRef.current = requestAnimationFrame(step)
    },
    [cancelAnimation],
  )

  useEffect(() => {
    return () => {
      cancelAnimation()
    }
  }, [cancelAnimation])

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
      startAnimation(container, target.x, target.y)
    },
    [autoScroll, containerRef, startAnimation],
  )

  // 選択された答案を画面中央にスクロール（自動スクロール設定に基づく）
  useEffect(() => {
    if (!autoScroll || !selectedAnswerId || !containerRef.current) {
      return
    }

    const container = containerRef.current
    const selectedElement = container.querySelector(
      `[data-answer-id="${selectedAnswerId}"]`,
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
        `[data-answer-id="${answerId}"]`,
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
