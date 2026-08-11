"use client"

import Image from "next/image"
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

interface MasterAnswerViewProps {
  /** 模範解答の画像URL（単一ページ用、後方互換） */
  masterImageUrl?: string | null
  /** 全ページの模範解答画像URL（ページ番号順） */
  masterImageUrls?: string[]
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
   * 答案側の画像サイズ（参照サイズ）
   * 模範解答と答案の画素数が異なる場合、答案側のサイズに合わせて描画する
   */
  referenceImageSize?: {
    width: number
    heights: number[]
  }
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
    masterImageUrl,
    masterImageUrls,
    zoom,
    opacity = 50,
    isOverlay = false,
    visible = true,
    pageSpacing = 20,
    referenceImageSize,
    answerScrollRef,
  },
  ref
) {
  // 単一URLも配列に揃える。毎レンダー新しい配列を作ると読み込みeffectが回り続けるため
  // memo 化し、呼び出し側（ScoringMainView）が渡す安定した参照をそのまま活かす
  const urls = useMemo(
    () => masterImageUrls ?? (masterImageUrl ? [masterImageUrl] : []),
    [masterImageUrls, masterImageUrl]
  )
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])
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

  // 全ページの画像を読み込み
  useEffect(() => {
    if (urls.length === 0) {
      setLoadedImages([])
      return
    }
    let cancelled = false
    const loadAll = async () => {
      const results = await Promise.allSettled(
        urls.map(
          (url) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const image = document.createElement("img")
              image.onload = () => resolve(image)
              image.onerror = reject
              image.src = url
            })
        )
      )
      if (cancelled) return
      setLoadedImages(
        results
          .filter(
            (result): result is PromiseFulfilledResult<HTMLImageElement> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value)
      )
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [urls])

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

  if (urls.length === 0) {
    if (isOverlay) return null
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400">
        模範解答なし
      </div>
    )
  }

  const refWidth = referenceImageSize?.width
  const refHeights = referenceImageSize?.heights

  const contentWidth = refWidth ?? (loadedImages[0]?.naturalWidth || 800)
  const contentHeight =
    refHeights && refHeights.length > 0
      ? refHeights.reduce(
          (total, h, index) =>
            total + h + (index < refHeights.length - 1 ? pageSpacing : 0),
          0
        )
      : loadedImages.length > 0
        ? loadedImages.reduce(
            (total, image, index) =>
              total +
              image.naturalHeight +
              (index < loadedImages.length - 1 ? pageSpacing : 0),
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
        {loadedImages.map((image, pageIndex) => {
          const displayWidth = refWidth ?? image.naturalWidth
          const displayHeight =
            refHeights && refHeights[pageIndex] !== undefined
              ? refHeights[pageIndex]
              : image.naturalHeight

          let offsetY = 0
          for (let i = 0; i < pageIndex; i++) {
            const h =
              refHeights && refHeights[i] !== undefined
                ? refHeights[i]
                : loadedImages[i]?.naturalHeight || 0
            offsetY += h + pageSpacing
          }

          return (
            <Image
              key={`master-page-${pageIndex}`}
              src={image.src}
              alt={`模範解答 ページ${pageIndex + 1}`}
              width={displayWidth}
              height={displayHeight}
              unoptimized
              // appimg:// は next/image の既定で lazy になる。ページを並べて
              // 表示する領域にあり、素の <img> は eager だった
              loading="eager"
              className="pointer-events-none absolute left-0 block"
              style={{
                top: `${offsetY * zoom}px`,
                width: `${displayWidth * zoom}px`,
                height: `${displayHeight * zoom}px`,
                imageRendering: "pixelated",
              }}
              draggable={false}
            />
          )
        })}
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
