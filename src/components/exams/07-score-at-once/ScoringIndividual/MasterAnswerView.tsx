"use client"

import Image from "next/image"
import { forwardRef, useCallback, useEffect, useRef } from "react"

import { useMasterOverlayImages } from "./hooks/view/useMasterOverlayImages"
import type { AnswerPageSize, MasterPageImage } from "./types"
import { placeMasterPagesOnAnswer } from "./utils/canvasPageLayout"

interface MasterAnswerViewProps {
  /** 全ページの模範解答画像（ページ番号順。答案のページとは examPageId で対応させる） */
  masterPages: MasterPageImage[]
  /** ズーム倍率（答案ビューと同期） */
  zoom: number
  /** overlay時の不透明度（0-100） */
  opacity?: number
  /** overlay時はtrue */
  isOverlay?: boolean
  /** overlay時の表示制御 */
  visible?: boolean
  /** ページ間隔（答案ビューと一致させる） */
  pageSpacing?: number
  /**
   * 答案側の読み込んだページの大きさ（参照サイズ）
   * 模範解答の各ページを、答案の同じページ（examPageId）の位置と大きさで描く
   */
  answerPageSizes?: AnswerPageSize[]
  /** 答案側のスクロールコンテナRef（wheelイベント転送用） */
  answerScrollRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * 模範解答画像ビューア（2画面表示用）
 * 答案ビューとzoom・scrollを同期して並列表示する
 */
export const MasterAnswerView = forwardRef<
  HTMLDivElement,
  MasterAnswerViewProps
>(function MasterAnswerView(
  {
    masterPages,
    zoom,
    opacity = 50,
    isOverlay = false,
    visible = true,
    pageSpacing = 20,
    answerPageSizes,
    answerScrollRef,
  },
  ref
) {
  // 読み込めなかったページは飛ばす（ページは examPageId で答案と対応させるので、後ろはずれない）
  const loadedMasterPages = useMasterOverlayImages(masterPages)
  const internalRef = useRef<HTMLDivElement>(null)

  // refを内部refと統合
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }
    },
    [ref]
  )

  // ホイールズーム: Ctrl/Meta + ホイールを答案側コンテナに転送
  // 答案側の既存のwheelハンドラがzoom計算を行い、onZoomChanged経由で同期される
  useEffect(() => {
    const container = internalRef.current
    if (!container || !answerScrollRef) return

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()

      const answerEl = answerScrollRef.current
      if (!answerEl) return

      // 答案側コンテナの対応する位置を計算してwheelイベントを転送
      const masterRect = container.getBoundingClientRect()
      const answerRect = answerEl.getBoundingClientRect()

      // マスター側のマウス位置をコンテナ内の相対位置（0-1）に変換
      const relX = (e.clientX - masterRect.left) / masterRect.width
      const relY = (e.clientY - masterRect.top) / masterRect.height

      // 答案側コンテナの対応するクライアント座標
      const answerClientX = answerRect.left + relX * answerRect.width
      const answerClientY = answerRect.top + relY * answerRect.height

      // 答案側に合成wheelイベントをdispatch
      const syntheticEvent = new WheelEvent("wheel", {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        clientX: answerClientX,
        clientY: answerClientY,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        bubbles: true,
      })
      answerEl.dispatchEvent(syntheticEvent)
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [answerScrollRef])

  if (masterPages.length === 0) {
    if (isOverlay) return null
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400">
        模範解答なし
      </div>
    )
  }

  // 答案に合わせて並べる。答案がまだ無い間は模範解答を自分の大きさで積む。
  // 答案に無いページの模範解答は並べない（答案側は「ある分だけ」を詰めて積むので、
  // 空けると答案とのスクロール同期で位置がずれる）
  const layoutPageSizes: AnswerPageSize[] =
    answerPageSizes && answerPageSizes.length > 0
      ? answerPageSizes
      : loadedMasterPages.map((loadedMasterPage) => ({
          examPageId: loadedMasterPage.examPageId,
          width: loadedMasterPage.image.naturalWidth,
          height: loadedMasterPage.image.naturalHeight,
        }))
  const masterPagePlacements = placeMasterPagesOnAnswer(
    loadedMasterPages,
    layoutPageSizes,
    pageSpacing
  )

  const contentWidth = layoutPageSizes[0]?.width || 800
  const contentHeight =
    layoutPageSizes.length > 0
      ? layoutPageSizes.reduce(
          (total, layoutPageSize, pageIndex) =>
            total +
            layoutPageSize.height +
            (pageIndex < layoutPageSizes.length - 1 ? pageSpacing : 0),
          0
        )
      : 600

  return (
    <div
      ref={setRefs}
      className={`h-full w-full ${isOverlay ? "" : "overflow-auto"}`}
      style={
        isOverlay
          ? {
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: visible ? opacity / 100 : 0,
              overflow: "auto",
              scrollbarWidth: "none",
              transition: "opacity 0.15s ease-in-out",
            }
          : {}
      }
    >
      <div
        className="relative grid place-items-center"
        style={{
          width: `${contentWidth * zoom}px`,
          height: `${contentHeight * zoom}px`,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        {masterPagePlacements.map(
          ({ masterPage, left, top, width, height }) => (
            <Image
              key={masterPage.examPageId}
              src={masterPage.image.src}
              alt="模範解答"
              width={width}
              height={height}
              unoptimized
              // appimg:// は next/image の既定で lazy になる。ページを並べて
              // 表示する領域にあり、素の <img> は eager だった
              loading="eager"
              className="pointer-events-none absolute block"
              style={{
                left: `${left * zoom}px`,
                top: `${top * zoom}px`,
                width: `${width * zoom}px`,
                height: `${height * zoom}px`,
                imageRendering: "pixelated",
              }}
              draggable={false}
            />
          )
        )}
      </div>

      {isOverlay && visible && (
        <div
          className="absolute top-2 left-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white"
          style={{ pointerEvents: "none" }}
        >
          模範解答
        </div>
      )}
    </div>
  )
})
