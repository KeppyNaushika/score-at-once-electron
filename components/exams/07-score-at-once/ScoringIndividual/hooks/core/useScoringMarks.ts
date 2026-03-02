/**
 * 採点記号画像管理フック
 * - 採点記号画像のプリロード
 * - キャッシュ管理
 */
import { useEffect } from "react"

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
}

/**
 * 採点記号画像のプリロードを管理するフック
 */
export function useScoringMarks({
  scoringMarkImagesRef,
}: UseScoringMarksProps): void {
  // 採点記号画像のプリロード
  useEffect(() => {
    const loadPromises = MARK_TYPES.map((type) => {
      return new Promise<void>((resolve) => {
        if (scoringMarkImagesRef.current.has(type)) {
          resolve()
          return
        }
        const img = new Image()
        img.onload = () => {
          scoringMarkImagesRef.current.set(type, img)
          resolve()
        }
        img.onerror = () => {
          console.warn(`Failed to load scoring mark: ${type}`)
          resolve()
        }
        // Next.jsのpublicフォルダからロード
        img.src = `/score-assets/${type}.png`
      })
    })
    Promise.all(loadPromises)
  }, [scoringMarkImagesRef])
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
