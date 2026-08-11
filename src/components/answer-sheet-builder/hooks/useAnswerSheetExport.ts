/**
 * PDF/PNG出力・印刷hook
 *
 * PDF/印刷/PNG: renderToStaticMarkup でプレビューと同じReactコンポーネントをHTML化
 *              → BrowserWindow + printToPDF / capturePage で出力
 */

import { useCallback, useState } from "react"
import { toast } from "sonner"

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import {
  generateAnswerSheetPageHtmls,
  generateAnswerSheetPrintHtml,
} from "../utils/generatePrintHtml"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

/** 解答用紙のPDF/PNG出力・印刷機能を提供するフック */
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
      if (pathResult.canceled) return

      const multiLayout = computeMultiPageLayoutFromDefinition(definition)
      const html = await generateAnswerSheetPrintHtml(definition, multiLayout)

      await exportApi.printHtmlToPdf({
        html,
        filePath: pathResult.filePath,
        pageSize: {
          width: multiLayout.pageWidthMm,
          height: multiLayout.pageHeightMm,
        },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })

      toast.success("PDFを出力しました")
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
        if (pathResult.canceled) return

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const htmlPages = await generateAnswerSheetPageHtmls(
          definition,
          multiLayout
        )

        await api.exportPng({
          htmlPages,
          outputPath: pathResult.filePath,
          dpi,
          pageWidthMm: multiLayout.pageWidthMm,
          pageHeightMm: multiLayout.pageHeightMm,
        })
        toast.success("PNGを出力しました")
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

      await exportApi.openPrintDialog({
        html,
        title: definition.name,
        pageSize: {
          width: multiLayout.pageWidthMm,
          height: multiLayout.pageHeightMm,
        },
      })

      toast.success("印刷プレビューを開きました")
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
