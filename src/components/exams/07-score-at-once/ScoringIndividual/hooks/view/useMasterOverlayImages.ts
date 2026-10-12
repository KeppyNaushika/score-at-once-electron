/**
 * @fileoverview 模範解答の画像読み込み（全ページ。答案に重ねる表示・左右に並べる表示）
 */
import { useEffect, useState } from "react"

import type { MasterPageImage } from "../../types"

/** 読み込めた模範解答の1ページ（どのページかと画像） */
export interface LoadedMasterPage {
  examPageId: string
  image: HTMLImageElement
}

/** 未読み込み時の空配列（毎レンダー作り直すと下流の再描画を誘発するため定数で持つ） */
const NO_OVERLAY_PAGES: LoadedMasterPage[] = []

/**
 * 模範解答の画像を読み込む。読み込めなかったページは飛ばす（ページは examPageId で
 * 答案と対応させるので、飛ばしても後ろのページはずれない）。
 *
 * 読み込み結果はどのページ列のものかを一緒に持ち、ページ列が差し替わったら（＝
 * オーバーレイOFFや別の試験）自然に外れるようにする
 *
 * @param masterOverlayPages - 模範解答のページ画像
 * @returns 読み込めたページ
 */
export function useMasterOverlayImages(
  masterOverlayPages: MasterPageImage[] | undefined
): LoadedMasterPage[] {
  const [loadedOverlay, setLoadedOverlay] = useState<{
    masterPages: MasterPageImage[]
    loadedPages: LoadedMasterPage[]
  } | null>(null)

  useEffect(() => {
    const masterPages = masterOverlayPages
    if (!masterPages || masterPages.length === 0) return
    let cancelled = false
    const loadAll = async () => {
      const results = await Promise.allSettled(
        masterPages.map(
          (masterPage) =>
            new Promise<LoadedMasterPage>((resolve, reject) => {
              const image = document.createElement("img")
              image.onload = () =>
                resolve({ examPageId: masterPage.examPageId, image })
              image.onerror = reject
              image.src = masterPage.imageUrl
            })
        )
      )
      if (cancelled) return
      setLoadedOverlay({
        masterPages,
        loadedPages: results
          .filter(
            (result): result is PromiseFulfilledResult<LoadedMasterPage> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value),
      })
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [masterOverlayPages])

  return loadedOverlay !== null &&
    loadedOverlay.masterPages === masterOverlayPages
    ? loadedOverlay.loadedPages
    : NO_OVERLAY_PAGES
}
