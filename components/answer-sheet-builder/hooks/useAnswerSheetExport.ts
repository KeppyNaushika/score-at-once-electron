/**
 * PDF/PNG出力・印刷hook
 *
 * PDF/印刷: renderToStaticMarkup でプレビューと同じReactコンポーネントをHTML化
 *          → 既存の export:openPrintDialog / export:printHtmlToPdf で出力
 * PNG:     SVG文字列 → sharp でラスタライズ（従来通り）
 */

import { useCallback, useState } from "react"
import { toast } from "sonner"

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import { generateAnswerSheetPrintHtml } from "../utils/generatePrintHtml"
import {
  renderMultiPageSvgStrings,
  resolveImageDataUris,
} from "../utils/renderSvgStrings"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

export function useAnswerSheetExport() {
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = useCallback(async (definition: AnswerSheetDefinition) => {
    const asbApi = window.electronAPI?.answerSheetBuilder
    const exportApi = window.electronAPI?.export
    if (!asbApi || !exportApi) {
      toast.error("Electron APIが利用できません")
      return
    }

    try {
      setIsExporting(true)

      const pathResult = await asbApi.selectSavePath({
        type: "pdf",
        defaultName: `${definition.name}.pdf`,
      })
      if (!pathResult.success || !pathResult.filePath) return

      const multiLayout = computeMultiPageLayoutFromDefinition(definition)
      const html = await generateAnswerSheetPrintHtml(definition, multiLayout)

      const result = await exportApi.printHtmlToPdf({
        html,
        filePath: pathResult.filePath,
        pageSize: {
          width: multiLayout.pageWidthMm,
          height: multiLayout.pageHeightMm,
        },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
    const exportApi = window.electronAPI?.export
    if (!exportApi) {
      toast.error("Electron APIが利用できません")
      return
    }

    try {
      setIsExporting(true)

      const multiLayout = computeMultiPageLayoutFromDefinition(definition)
      const html = await generateAnswerSheetPrintHtml(definition, multiLayout)

      const result = await exportApi.openPrintDialog({
        html,
        title: definition.name,
        pageSize: {
          width: multiLayout.pageWidthMm,
          height: multiLayout.pageHeightMm,
        },
      })

      if (result.success) {
        toast.success("印刷プレビューを開きました")
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
