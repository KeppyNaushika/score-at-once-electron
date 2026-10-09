import { useCallback, useState } from "react"

/**
 * 手書きの変更をキャンバス・一覧パネル・グリッドの間で伝え合う合図。
 * 増えたら取り直す数を、伝える向きごとに持つ
 */
export function useAnnotationVersions() {
  const [annotationVersionForBrowser, setAnnotationVersionForBrowser] =
    useState(0)
  const [annotationVersionForCanvas, setAnnotationVersionForCanvas] =
    useState(0)
  const [annotationVersionForGrid, setAnnotationVersionForGrid] = useState(0)

  // キャンバスでアノテーション変更 → ブラウザパネル一覧 + Grid一覧をリロード
  const handleCanvasAnnotationChanged = useCallback(() => {
    setAnnotationVersionForBrowser((prev) => prev + 1)
    setAnnotationVersionForGrid((prev) => prev + 1)
  }, [])

  // ブラウザの+ボタンでアノテーション追加 → キャンバスプレビュー + Grid一覧をリロード
  const handleBrowserAnnotationAdded = useCallback(() => {
    setAnnotationVersionForCanvas((prev) => prev + 1)
    setAnnotationVersionForGrid((prev) => prev + 1)
  }, [])

  // 画面の外（ルーブリック項目の助言から作る朱書き）で注釈が変わった → 全部をリロード
  const handleAnnotationsChangedElsewhere = useCallback(() => {
    setAnnotationVersionForBrowser((prev) => prev + 1)
    setAnnotationVersionForCanvas((prev) => prev + 1)
    setAnnotationVersionForGrid((prev) => prev + 1)
  }, [])

  return {
    annotationVersionForBrowser,
    annotationVersionForCanvas,
    annotationVersionForGrid,
    handleCanvasAnnotationChanged,
    handleBrowserAnnotationAdded,
    handleAnnotationsChangedElsewhere,
  }
}
