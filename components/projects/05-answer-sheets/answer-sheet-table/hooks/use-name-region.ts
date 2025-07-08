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
      const layoutRegions =
        await window.electronAPI.getLayoutRegionsByProjectId(projectId)
      const masterImages =
        await window.electronAPI.getMasterImagesByProjectId(projectId)

      console.log("useNameRegion - layoutRegions:", layoutRegions)
      console.log("useNameRegion - STUDENT_NAME領域の数:", layoutRegions.filter(r => r.type === "STUDENT_NAME").length)
      console.log("useNameRegion - masterImages:", masterImages)

      const availability: Record<number, boolean> = {}

      for (const masterImage of masterImages) {
        const nameRegion = layoutRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" &&
            region.masterImageId === masterImage.id,
        )
        availability[masterImage.pageNumber] = !!nameRegion
        console.log(`useNameRegion - ページ${masterImage.pageNumber}: nameRegion=${!!nameRegion}`, nameRegion ? nameRegion : "なし")
      }

      console.log("useNameRegion - availability:", availability)
      setNameRegionAvailable(availability)
    } catch (error) {
      console.error("氏名欄領域確認エラー:", error)
    }
  }, [projectId])

  // 氏名欄クリッピング用のcanvas描画
  const drawNameRegionCanvas = useCallback(
    async (file: UnifiedFile, pageNumber: number) => {
      console.log("drawNameRegionCanvas - 開始 - file:", file.name, "pageNumber:", pageNumber)
      const canvas = canvasRef.current
      if (!canvas) {
        console.log("drawNameRegionCanvas - canvasRef.current is null")
        return null
      }

      try {
        // LayoutRegionからSTUDENT_NAME領域を取得
        const layoutRegions =
          await window.electronAPI.getLayoutRegionsByProjectId(projectId)

        // ページ番号に基づいてmasterImageIdを取得
        const masterImages =
          await window.electronAPI.getMasterImagesByProjectId(projectId)
        const masterImage = masterImages.find(
          (img) => img.pageNumber === pageNumber,
        )

        console.log("drawNameRegionCanvas - masterImage:", masterImage)

        if (!masterImage) {
          console.log("drawNameRegionCanvas - masterImage not found")
          return null
        }

        const nameRegion = layoutRegions.find(
          (region) =>
            region.type === "STUDENT_NAME" &&
            region.masterImageId === masterImage.id,
        )

        console.log("drawNameRegionCanvas - nameRegion:", nameRegion)

        if (!nameRegion || !file.preview) {
          console.log("drawNameRegionCanvas - nameRegion or file.preview is null")
          return null
        }

        // 画像を読み込み
        const img = new Image()
        img.crossOrigin = "anonymous"

        return new Promise<string | null>((resolve) => {
          img.onload = () => {
            console.log("drawNameRegionCanvas - 画像読み込み完了")
            // canvasのサイズを設定
            const regionWidth = nameRegion.width * img.naturalWidth
            const regionHeight = nameRegion.height * img.naturalHeight

            console.log("drawNameRegionCanvas - regionWidth:", regionWidth, "regionHeight:", regionHeight)

            canvas.width = regionWidth
            canvas.height = regionHeight

            const ctx = canvas.getContext("2d")
            if (!ctx) {
              console.log("drawNameRegionCanvas - context取得失敗")
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

            console.log("drawNameRegionCanvas - canvas描画完了")
            // データURLを返す
            resolve(canvas.toDataURL())
          }

          img.onerror = () => {
            console.log("drawNameRegionCanvas - 画像読み込みエラー")
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
