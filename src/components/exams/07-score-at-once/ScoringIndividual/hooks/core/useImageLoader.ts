/**
 * 画像読み込み・キャッシュ管理フック
 * - 答案画像の読み込み
 * - 複数ページ対応
 * - ファイル存在確認
 */
import { useEffect, useState } from "react"

import type {
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { checkFileExists } from "@/queries/misc"

import type { ImageLoaderReturn } from "./types"

interface UseImageLoaderProps {
  currentScoringData: ScoringData | null
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  showMultiplePages?: boolean
  imageRef: React.RefObject<HTMLImageElement | null>
}

/**
 * 画像読み込みを管理するフック
 */
export function useImageLoader({
  currentScoringData,
  studentAnswerImages,
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

      let imagesToLoad: { path: string; pageNumber: number }[]

      if (showMultiplePages && studentAnswerImages) {
        // 複数ページ表示：同一生徒の全ページを取得
        const studentAnswerSheets = studentAnswerImages
          .filter(
            (sheet) => sheet.examStudentId === currentScoringData.examStudentId
          )
          .sort(
            (sheetA, sheetB) =>
              (sheetA.examPage?.pageNumber || 1) -
              (sheetB.examPage?.pageNumber || 1)
          )

        imagesToLoad = studentAnswerSheets.map((sheet) => ({
          path: sheet.imagePath,
          pageNumber: sheet.examPage?.pageNumber || 1,
        }))
      } else {
        // 単一ページ表示：ScoringDataのimageUrlを使用（Grid Viewと同じ）
        // appimg:// または appimg:/// の両方に対応
        const imagePath = currentScoringData.imageUrl.replace(
          /^appimg:\/\/\/?/,
          ""
        )
        imagesToLoad = [{ path: imagePath, pageNumber: 1 }]
      }

      // 画像を並列読み込み
      const loadPromises = imagesToLoad.map(async (imageInfo) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()

          image.onload = () => resolve(image)
          image.onerror = (error) => {
            console.error(
              `Failed to load image for page ${imageInfo.pageNumber}:`,
              error
            )
            reject(error)
          }

          // ファイル存在確認して読み込み（appimg:///プロトコル使用）
          checkFileExists(imageInfo.path)
            .then((result) => {
              if (result.exists) {
                // 相対パスを使用（appimg:// プロトコルハンドラー内で絶対パスに変換される）
                // 絶対パスを使うと appimg:////Users/... となりURL正規化でパスが壊れる
                image.src = `appimg:///${imageInfo.path}`
              } else {
                console.warn(`File does not exist: ${imageInfo.path}`)
                reject(new Error(`File not found: ${imageInfo.path}`))
              }
            })
            .catch((error) => {
              console.error("Error checking file existence:", error)
              image.src = `appimg:///${imageInfo.path}` // フォールバック
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
  }, [currentScoringData, studentAnswerImages, showMultiplePages, imageRef])

  return {
    imageLoaded,
    loadedImages,
  }
}
