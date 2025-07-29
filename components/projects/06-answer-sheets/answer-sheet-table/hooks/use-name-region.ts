import type { UnifiedFile } from "@/types/answer-sheet.types"
import { useCallback, useRef, useState } from "react"

export function useNameRegion(projectId: string) {
  const [nameRegionAvailable, setNameRegionAvailable] = useState<
    Record<number, boolean>
  >({})
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 氏名欄領域の存在確認
  const checkNameRegionAvailability = useCallback(async () => {
    try {
      const cropRegions =
        await window.electronAPI.getCropRegionsByProjectId(projectId)
      const masterImages =
        await window.electronAPI.getMasterImagesByProjectId(projectId)


      const availability: Record<number, boolean> = {}

      for (const masterImage of masterImages) {
        const nameRegion = cropRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" &&
            region.projectPageId === masterImage.id,
        )
        availability[masterImage.pageNumber] = !!nameRegion
      }

      setNameRegionAvailable(availability)
    } catch (error) {
      console.error("氏名欄領域確認エラー:", error)
    }
  }, [projectId])

  // 氏名欄クリッピング用のcanvas描画
  const drawNameRegionCanvas = useCallback(
    async (file: UnifiedFile, pageNumber: number) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return null
      }

      try {
        // CropRegionからSTUDENT_NAME領域を取得
        const cropRegions =
          await window.electronAPI.getCropRegionsByProjectId(projectId)

        // ページ番号に基づいてmasterImageIdを取得
        const masterImages =
          await window.electronAPI.getMasterImagesByProjectId(projectId)
        const masterImage = masterImages.find(
          (img) => img.pageNumber === pageNumber,
        )


        if (!masterImage) {
          return null
        }

        const nameRegion = cropRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" &&
            region.projectPageId === masterImage.id,
        )


        if (!nameRegion || !file.preview) {
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
              regionHeight,
            )

            // データURLを返す
            resolve(canvas.toDataURL())
          }

          img.onerror = () => {
            resolve(null)
          }
          img.src = file.preview || ""
        })
      } catch (error) {
        console.error("氏名欄クリッピングエラー:", error)
        return null
      }
    },
    [projectId],
  )

  return {
    nameRegionAvailable,
    canvasRef,
    checkNameRegionAvailability,
    drawNameRegionCanvas,
  }
}
