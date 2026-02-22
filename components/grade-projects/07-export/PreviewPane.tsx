"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface PreviewPaneProps {
  html: string
}

const ZOOM_MIN = 0.2
const ZOOM_MAX = 3.0
const ZOOM_OUT_DELTA = 0.9
const ZOOM_IN_DELTA = 1.1

/**
 * A4プレビューペイン（Shadow DOM + Ctrl+Wheel ズーム）
 *
 * - Shadow DOMでスタイルをカプセル化
 * - Ctrl+ホイール（= macOSトラックパッドピンチ）でズーム
 * - 初期表示はコンテナ横幅にフィット（実測ベース）
 */
export function PreviewPane({ html }: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const contentSizeRef = useRef({ width: 595, height: 842 })
  const initializedRef = useRef(false)

  // Shadow DOMにHTMLを挿入し、実際の描画サイズを測定
  useEffect(() => {
    const el = hostRef.current
    if (!el || !html) return

    const shadow = el.shadowRoot ?? el.attachShadow({ mode: "open" })

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    shadow.innerHTML = ""

    doc.querySelectorAll("style").forEach((style) => {
      shadow.appendChild(style.cloneNode(true))
    })

    const wrapperStyle = document.createElement("style")
    wrapperStyle.textContent = `
      .preview-wrapper {
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06);
        display: inline-block;
      }
    `
    shadow.appendChild(wrapperStyle)

    const wrapper = document.createElement("div")
    wrapper.className = "preview-wrapper"
    wrapper.innerHTML = doc.body.innerHTML
    shadow.appendChild(wrapper)

    // 描画後にコンテンツの実寸を測定
    requestAnimationFrame(() => {
      const w = wrapper.offsetWidth
      const h = wrapper.offsetHeight
      if (w > 0 && h > 0) {
        contentSizeRef.current = { width: w, height: h }
      }

      // 初期スケールを算出
      if (!initializedRef.current) {
        const container = containerRef.current
        if (container) {
          const cs = getComputedStyle(container)
          const availableWidth =
            container.clientWidth -
            parseFloat(cs.paddingLeft) -
            parseFloat(cs.paddingRight)
          if (availableWidth > 0 && contentSizeRef.current.width > 0) {
            setScale(Math.min(availableWidth / contentSizeRef.current.width, 1))
            initializedRef.current = true
          }
        }
      }
    })
  }, [html])

  // Ctrl+Wheel ズーム（macOSトラックパッドピンチ対応）
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()

      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const currentScale = scale ?? 1
      const delta = e.deltaY > 0 ? ZOOM_OUT_DELTA : ZOOM_IN_DELTA
      const newScale = Math.min(
        Math.max(currentScale * delta, ZOOM_MIN),
        ZOOM_MAX
      )

      const scrollX = container.scrollLeft + mouseX
      const scrollY = container.scrollTop + mouseY
      const imgX = scrollX / currentScale
      const imgY = scrollY / currentScale

      setScale(newScale)
      requestAnimationFrame(() => {
        container.scrollTo(imgX * newScale - mouseX, imgY * newScale - mouseY)
      })
    },
    [scale]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  const s = scale ?? 1
  const { width: cw, height: ch } = contentSizeRef.current

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-auto rounded-md border bg-gray-100 p-2"
    >
      <div
        style={{
          width: cw * s,
          height: ch * s,
          margin: "0 auto",
          visibility: scale !== null ? "visible" : "hidden",
        }}
      >
        <div
          ref={hostRef}
          style={{
            transform: `scale(${s})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  )
}
