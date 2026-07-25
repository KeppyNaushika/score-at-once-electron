import { useCallback, useRef, useState } from "react"

/** 答案画像から氏名欄領域をクリッピングして表示するためのフック */
export function useNameRegion(examId: string) {
  // 氏名欄（STUDENT_NAME の CropRegion）を持つ ExamPage の id 集合。
  // 序数 pageNumber ではなく id でキーする（ページ挿入・並べ替えでずれないため）。
  const [nameRegionExamPageIds, setNameRegionExamPageIds] = useState<
    Set<string>
  >(new Set())
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 氏名欄領域の存在確認
  const checkNameRegionAvailability = useCallback(async () => {
    try {
      const cropRegions =
        await window.electronAPI.getCropRegionsByExamId(examId)

      setNameRegionExamPageIds(
        new Set(
          cropRegions
            .filter((region) => region.type === "STUDENT_NAME")
            .map((region) => region.examPageId)
        )
      )
    } catch (error) {
      console.error("氏名欄領域確認エラー:", error)
    }
  }, [examId])

  // 氏名欄クリッピング用のcanvas描画。表示ソース（データURL）と対象ページの id を受け取る
  // （答案の同定・実体には依存しない＝表示専用の純関数）。列に対応する ExamPage が無い
  // 孤立答案は examPageId が null で、クリップ対象外として null を返す。
  const drawNameRegionCanvas = useCallback(
    async (previewUrl: string | null, examPageId: string | null) => {
      const canvas = canvasRef.current
      if (!canvas || !examPageId) {
        return null
      }

      try {
        // CropRegionからSTUDENT_NAME領域を取得
        const cropRegions =
          await window.electronAPI.getCropRegionsByExamId(examId)

        const nameRegion = cropRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" && region.examPageId === examPageId
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
    nameRegionExamPageIds,
    canvasRef,
    checkNameRegionAvailability,
    drawNameRegionCanvas,
  }
}
