/**
 * 画像読み込み・キャッシュ管理フック
 * - 答案画像の読み込み
 * - 複数ページ対応
 * - ファイル存在確認
 */
import type {
  PageImageWithProjectStudents,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"
import { useEffect, useState } from "react"
import type { ImageLoaderReturn } from "./types"

interface UseImageLoaderProps {
  currentScoringData: ScoringData | null
  pageImages?: PageImageWithProjectStudents[]
  showMultiplePages?: boolean
  imageRef: React.RefObject<HTMLImageElement | null>
}

/**
 * 画像読み込みを管理するフック
 */
export function useImageLoader({
  currentScoringData,
  pageImages,
  showMultiplePages,
  imageRef,
}: UseImageLoaderProps): ImageLoaderReturn {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])

  // 画像読み込み処理（Grid Viewと同じロジックを使用）
  useEffect(() => {
    const loadAnswerImages = async () => {
      if (!currentScoringData) {
        console.warn("useImageLoader: No currentScoringData provided")
        setImageLoaded(false)
        return
      }

      let imagesToLoad: { path: string; pageNumber: number }[] = []

      if (showMultiplePages && pageImages) {
        // 複数ページ表示：同一生徒の全ページを取得
        const studentAnswerSheets = pageImages
          .filter((sheet) => sheet.studentId === currentScoringData.studentId)
          .sort(
            (a, b) =>
              (a.projectPage?.pageNumber || 1) -
              (b.projectPage?.pageNumber || 1)
          )

        imagesToLoad = studentAnswerSheets.map((sheet) => ({
          path: sheet.imagePath,
          pageNumber: sheet.projectPage?.pageNumber || 1,
        }))
      } else {
        // 単一ページ表示：ScoringDataのimageUrlを使用（Grid Viewと同じ）
        const imagePath = currentScoringData.imageUrl.replace("appimg://", "")
        imagesToLoad = [{ path: imagePath, pageNumber: 1 }]
      }

      // 画像を並列読み込み
      const loadPromises = imagesToLoad.map(async (imageInfo) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()

          img.onload = () => resolve(img)
          img.onerror = (error) => {
            console.error(
              `Failed to load image for page ${imageInfo.pageNumber}:`,
              error
            )
            reject(error)
          }

          // ファイル存在確認して読み込み（appimg://プロトコル使用）
          window.electronAPI
            .checkFileExists(imageInfo.path)
            .then((result) => {
              if (result.success && result.exists) {
                img.src = `appimg://${result.path}`
              } else {
                console.warn(`File does not exist: ${imageInfo.path}`)
                reject(new Error(`File not found: ${imageInfo.path}`))
              }
            })
            .catch((error) => {
              console.error("Error checking file existence:", error)
              img.src = `appimg://${imageInfo.path}` // フォールバック
            })
        })
      })

      try {
        const loadedImageArray = await Promise.all(loadPromises)
        setLoadedImages(loadedImageArray)
        setImageLoaded(true)

        // 隠しimg要素に最初の画像のsrcを設定（座標計算用）
        if (loadedImageArray.length > 0 && imageRef.current) {
          const firstImage = loadedImageArray[0]
          imageRef.current.src = firstImage.src
        }
      } catch (error) {
        console.error("Failed to load some images:", error)
        // 部分的に読み込めた画像があれば表示
        const partialResults = await Promise.allSettled(loadPromises)
        const successfulImages = partialResults
          .filter(
            (result): result is PromiseFulfilledResult<HTMLImageElement> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value)

        if (successfulImages.length > 0) {
          setLoadedImages(successfulImages)
          setImageLoaded(true)

          // 隠しimg要素に最初の画像のsrcを設定（部分読み込みの場合）
          if (successfulImages.length > 0 && imageRef.current) {
            const firstImage = successfulImages[0]
            imageRef.current.src = firstImage.src
          }
        } else {
          setImageLoaded(false)
        }
      }
    }

    if (currentScoringData) {
      loadAnswerImages()
    }
  }, [currentScoringData, pageImages, showMultiplePages, imageRef])

  return {
    imageLoaded,
    loadedImages,
  }
}
