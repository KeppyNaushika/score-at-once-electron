/**
 * PDF/PNG出力hook
 *
 * renderer側でlayout計算→SVG生成→main側にデータを渡す。
 */

import { useCallback, useState } from "react"
import { toast } from "sonner"

import type { AnswerSheetDefinition } from "@/types/answerSheetBuilder.types"

import {
  renderMultiPageSvgStrings,
  resolveImageDataUris,
  wrapSvgsInHtml,
} from "../utils/renderSvgStrings"
import { computeMultiPageLayoutFromDefinition } from "./useAnswerSheetLayout"

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

      const multiLayout = computeMultiPageLayoutFromDefinition(definition)
      const allCells = multiLayout.pages.flatMap((p) => p.cells)
      const imageDataUris = await resolveImageDataUris(allCells)
      const svgStrings = renderMultiPageSvgStrings(
        multiLayout,
        definition.renderMode,
        imageDataUris
      )
      const html = wrapSvgsInHtml(
        svgStrings,
        multiLayout.pageWidthMm,
        multiLayout.pageHeightMm
      )

      const result = await api.exportPdf({
        html,
        outputPath: pathResult.filePath,
        pageWidthMm: multiLayout.pageWidthMm,
        pageHeightMm: multiLayout.pageHeightMm,
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

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const allCells = multiLayout.pages.flatMap((p) => p.cells)
        const imageDataUris = await resolveImageDataUris(allCells)
        const svgStrings = renderMultiPageSvgStrings(
          multiLayout,
          definition.renderMode,
          imageDataUris
        )

        const result = await api.exportPng({
          svgStrings,
          outputPath: pathResult.filePath,
          dpi,
          pageWidthMm: multiLayout.pageWidthMm,
          pageHeightMm: multiLayout.pageHeightMm,
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

  const printSheet = useCallback(async (definition: AnswerSheetDefinition) => {
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) {
      toast.error("Electron APIが利用できません")
      return
    }

    try {
      setIsExporting(true)

      const multiLayout = computeMultiPageLayoutFromDefinition(definition)
      const allCells = multiLayout.pages.flatMap((p) => p.cells)
      const imageDataUris = await resolveImageDataUris(allCells)
      const svgStrings = renderMultiPageSvgStrings(
        multiLayout,
        definition.renderMode,
        imageDataUris
      )
      const html = wrapSvgsInHtml(
        svgStrings,
        multiLayout.pageWidthMm,
        multiLayout.pageHeightMm
      )

      const result = await api.print({
        html,
        pageWidthMm: multiLayout.pageWidthMm,
        pageHeightMm: multiLayout.pageHeightMm,
      })

      if (result.success) {
        toast.success("印刷を開始しました")
      } else if (result.error) {
        toast.error(`印刷エラー: ${result.error}`)
      }
    } catch (error) {
      toast.error(
        `印刷エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportPdf, exportPng, printSheet, isExporting }
}
