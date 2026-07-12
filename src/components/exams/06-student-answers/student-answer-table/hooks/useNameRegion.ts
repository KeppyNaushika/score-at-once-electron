import { useCallback, useRef, useState } from "react"

/** 答案画像から氏名欄領域をクリッピングして表示するためのフック */
export function useNameRegion(examId: string) {
  const [nameRegionAvailable, setNameRegionAvailable] = useState<
    Record<number, boolean>
  >({})
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 氏名欄領域の存在確認
  const checkNameRegionAvailability = useCallback(async () => {
    try {
      const cropRegions =
        await window.electronAPI.getCropRegionsByExamId(examId)
      const examPages = await window.electronAPI.getExamPagesByExamId(examId)

      const availability: Record<number, boolean> = {}

      for (const examPage of examPages) {
        const nameRegion = cropRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" && region.examPageId === examPage.id
        )
        availability[examPage.pageNumber] = !!nameRegion
      }

      setNameRegionAvailable(availability)
    } catch (error) {
      console.error("氏名欄領域確認エラー:", error)
    }
  }, [examId])

  // 氏名欄クリッピング用のcanvas描画。表示ソース（データURL）を直接受け取る
  // （答案の同定・実体には依存しない＝表示専用の純関数）。
  const drawNameRegionCanvas = useCallback(
    async (previewUrl: string | null, pageNumber: number) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return null
      }

      try {
        // CropRegionからSTUDENT_NAME領域を取得
        const cropRegions =
          await window.electronAPI.getCropRegionsByExamId(examId)

        // ページ番号に基づいてexamPageIdを取得
        const examPages = await window.electronAPI.getExamPagesByExamId(examId)
        const examPage = examPages.find(
          (page) => page.pageNumber === pageNumber
        )

        if (!examPage) {
          return null
        }

        const nameRegion = cropRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" && region.examPageId === examPage.id
        )

        if (!nameRegion || !previewUrl) {
          return null
        }

        // 画像を読み込み
        const img = new Image()
        img.crossOrigin = "anonymous"

        return new Promise<string | null>((resolve) => {
          img.onload = () => {
            // canvasのサイズを設定
            const regionWidth = nameRegion.width * img.naturalWidth
            const regionHeight = nameRegion.height * img.naturalHeight

            canvas.width = regionWidth
            canvas.height = regionHeight

            const ctx = canvas.getContext("2d")
            if (!ctx) {
              resolve(null)
              return
            }

            // 氏名欄領域のみを描画
            ctx.drawImage(
              img,
              nameRegion.x * img.naturalWidth,
              nameRegion.y * img.naturalHeight,
              regionWidth,
              regionHeight,
              0,
              0,
              regionWidth,
              regionHeight
            )

            // データURLを返す
            resolve(canvas.toDataURL())
          }

          img.onerror = () => {
            resolve(null)
          }
          img.src = previewUrl
        })
      } catch (error) {
        console.error("氏名欄クリッピングエラー:", error)
        return null
      }
    },
    [examId]
  )

  return {
    nameRegionAvailable,
    canvasRef,
    checkNameRegionAvailability,
    drawNameRegionCanvas,
  }
}
