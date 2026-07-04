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
  "pending",
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
        const image = new Image()
        image.onload = () => {
          scoringMarkImagesRef.current.set(type, image)
          resolve()
        }
        image.onerror = () => {
          console.warn(`Failed to load scoring mark: ${type}`)
          resolve()
        }
        // Next.jsのpublicフォルダからロード
        image.src = `/score-assets/${type}.png`
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
    case "no_answer":
    case "double_mark":
      return "incorrect"
    case "correct":
    case "incorrect":
    case "partial":
    case "pending":
      return status as MarkType
    default:
      return null
  }
}
