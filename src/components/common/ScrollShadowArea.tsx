"use client"

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface ScrollShadowAreaProps {
  /** 高さの上限など、スクロールする箱に付けるクラス（`max-h-72` など） */
  className?: string
  children: ReactNode
}

/**
 * 縦にスクロールする箱。続きがある側（上・下）の内側に影を落とし、スクロールできる
 * ことを示す。
 *
 * 影は箱の背景ではなく、上に重ねた要素で描く。背景で描く方法（background-attachment の
 * local と scroll を重ねるもの）は、中身に背景色の付いた要素（見出しの帯など）があると
 * その下に隠れて見えないため。
 */
export function ScrollShadowArea({
  className,
  children,
}: ScrollShadowAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const updateEdges = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    const { scrollTop, scrollHeight, clientHeight } = element
    // 小数の端数で影が残らないよう 1px の遊びを持たせる
    const top = scrollTop > 1
    const bottom = scrollTop + clientHeight < scrollHeight - 1
    setEdges((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    )
  }, [])

  // 中身や箱の大きさが変わったとき（開いた直後・データが届いたとき）も測り直す
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    updateEdges()
    const observer = new ResizeObserver(updateEdges)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [updateEdges, children])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={updateEdges}
        className={cn("overflow-y-auto", className)}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/15 to-transparent transition-opacity dark:from-black/50",
          edges.top ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/15 to-transparent transition-opacity dark:from-black/50",
          edges.bottom ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}
