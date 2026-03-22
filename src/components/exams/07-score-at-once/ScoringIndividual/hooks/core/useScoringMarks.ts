/**
 * 採点記号画像管理フック
 * - 採点記号画像のプリロード
 * - キャッシュ管理
 * - 透過マーク切替対応
 */
import { useEffect, useRef } from "react"

const MARK_TYPES = [
  "correct",
  "incorrect",
  "partial",
  "hold",
  "unscored",
] as const
type MarkType = (typeof MARK_TYPES)[number]

interface UseScoringMarksProps {
  scoringMarkImagesRef: React.MutableRefObject<Map<string, HTMLImageElement>>
  useTransparent?: boolean
}

/**
 * 採点記号画像のプリロードを管理するフック
 */
export function useScoringMarks({
  scoringMarkImagesRef,
  useTransparent = false,
}: UseScoringMarksProps): void {
  const prevTransparentRef = useRef(useTransparent)

  // 採点記号画像のプリロード（透過設定変更時は再ロード）
  useEffect(() => {
    const transparentChanged = prevTransparentRef.current !== useTransparent
    prevTransparentRef.current = useTransparent
    const prefix = useTransparent ? "tp_" : ""

    const loadPromises = MARK_TYPES.map((type) => {
      return new Promise<void>((resolve) => {
        // 透過設定が変わった場合はキャッシュをクリアして再ロード
        if (!transparentChanged && scoringMarkImagesRef.current.has(type)) {
          resolve()
          return
        }
        const img = new Image()
        img.onload = () => {
          scoringMarkImagesRef.current.set(type, img)
          resolve()
        }
        img.onerror = () => {
          console.warn(`Failed to load scoring mark: ${prefix}${type}`)
          resolve()
        }
        // Next.jsのpublicフォルダからロード
        img.src = `/score-assets/${prefix}${type}.png`
      })
    })
    Promise.all(loadPromises)
  }, [scoringMarkImagesRef, useTransparent])
}

/**
 * ステータスから採点記号画像のキーを取得
 */
export function getScoringMarkKey(status: string): MarkType | null {
  switch (status) {
    case "pending":
      return "hold"
    case "no_answer":
      return "incorrect"
    case "correct":
    case "incorrect":
    case "partial":
      return status as MarkType
    default:
      return null
  }
}
