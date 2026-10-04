/**
 * @fileoverview 模範解答オーバーレイ用の画像読み込み（全ページ）
 */
import { useEffect, useState } from "react"

/** 未読み込み時の空配列（毎レンダー作り直すと下流の再描画を誘発するため定数で持つ） */
const NO_OVERLAY_IMAGES: HTMLImageElement[] = []

/**
 * 模範解答の画像を読み込む。読み込めなかったページは飛ばす。
 *
 * 読み込み結果はどのURL列のものかを一緒に持ち、URLが差し替わったら（＝
 * オーバーレイOFFや別の試験）自然に外れるようにする
 *
 * @param masterOverlayImageUrls - 模範解答のページ画像のURL
 * @returns 読み込めたページ画像
 */
export function useMasterOverlayImages(
  masterOverlayImageUrls: string[] | undefined
): HTMLImageElement[] {
  const [loadedOverlay, setLoadedOverlay] = useState<{
    urls: string[]
    images: HTMLImageElement[]
  } | null>(null)

  useEffect(() => {
    const urls = masterOverlayImageUrls
    if (!urls || urls.length === 0) return
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
      setLoadedOverlay({
        urls,
        images: results
          .filter(
            (result): result is PromiseFulfilledResult<HTMLImageElement> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value),
      })
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [masterOverlayImageUrls])

  return loadedOverlay !== null && loadedOverlay.urls === masterOverlayImageUrls
    ? loadedOverlay.images
    : NO_OVERLAY_IMAGES
}
