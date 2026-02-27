/**
 * PDF/PNG出力hook
 */

import { useCallback, useState } from "react"
import { toast } from "sonner"

import type { AnswerSheetDefinition } from "@/types/answerSheetBuilder.types"

export function useAnswerSheetExport() {
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = useCallback(async (definition: AnswerSheetDefinition) => {
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) {
      toast.error("Electron APIが利用できません")
      return
    }

    try {
      setIsExporting(true)

      const pathResult = await api.selectSavePath({
        type: "pdf",
        defaultName: `${definition.name}.pdf`,
      })

      if (!pathResult.success || !pathResult.filePath) return

      const result = await api.exportPdf({
        definition,
        outputPath: pathResult.filePath,
      })

      if (result.success) {
        toast.success("PDFを出力しました")
      } else {
        toast.error(`PDF出力エラー: ${result.error}`)
      }
    } catch (error) {
      toast.error(
        `PDF出力エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    } finally {
      setIsExporting(false)
    }
  }, [])

  const exportPng = useCallback(
    async (definition: AnswerSheetDefinition, dpi: number = 300) => {
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) {
        toast.error("Electron APIが利用できません")
        return
      }

      try {
        setIsExporting(true)

        const pathResult = await api.selectSavePath({
          type: "png",
          defaultName: `${definition.name}.png`,
        })

        if (!pathResult.success || !pathResult.filePath) return

        const result = await api.exportPng({
          definition,
          outputPath: pathResult.filePath,
          dpi,
        })

        if (result.success) {
          toast.success("PNGを出力しました")
        } else {
          toast.error(`PNG出力エラー: ${result.error}`)
        }
      } catch (error) {
        toast.error(
          `PNG出力エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
        )
      } finally {
        setIsExporting(false)
      }
    },
    []
  )

  return { exportPdf, exportPng, isExporting }
}
