/**
 * PDF/PNG出力・印刷hook
 *
 * PDF/印刷/PNG: renderToStaticMarkup でプレビューと同じReactコンポーネントをHTML化
 *              → BrowserWindow + printToPDF / capturePage で出力
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  exportAnswerSheetPngMutation,
  selectAnswerSheetSavePathMutation,
} from "@/queries/answerSheetBuilder"
import {
  openPrintDialogMutation,
  printHtmlToPdfMutation,
} from "@/queries/export"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import {
  generateAnswerSheetPageHtmls,
  generateAnswerSheetPrintHtml,
} from "../utils/generatePrintHtml"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

/** 解答用紙のPDF/PNG出力・印刷機能を提供するフック */
export function useAnswerSheetExport() {
  const [isExporting, setIsExporting] = useState(false)
  const { mutateAsync: selectSavePath } = useMutation(
    selectAnswerSheetSavePathMutation()
  )
  const { mutateAsync: printHtmlToPdf } = useMutation(printHtmlToPdfMutation())
  const { mutateAsync: exportPngFile } = useMutation(
    exportAnswerSheetPngMutation()
  )
  const { mutateAsync: openPrintDialog } = useMutation(
    openPrintDialogMutation()
  )

  const exportPdf = useCallback(
    async (definition: AnswerSheetDefinition) => {
      try {
        setIsExporting(true)

        const pathResult = await selectSavePath({
          type: "pdf",
          defaultName: `${definition.name}.pdf`,
        })
        if (pathResult.canceled) return

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const html = await generateAnswerSheetPrintHtml(definition, multiLayout)

        await printHtmlToPdf({
          html,
          filePath: pathResult.filePath,
          pageSize: {
            width: multiLayout.pageWidthMm,
            height: multiLayout.pageHeightMm,
          },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        })

        toast.success("PDFを出力しました")
      } catch {
        // 失敗の通知は MutationCache が出す
      } finally {
        setIsExporting(false)
      }
    },
    [selectSavePath, printHtmlToPdf]
  )

  const exportPng = useCallback(
    async (definition: AnswerSheetDefinition, dpi: number = 300) => {
      try {
        setIsExporting(true)

        const pathResult = await selectSavePath({
          type: "png",
          defaultName: `${definition.name}.png`,
        })
        if (pathResult.canceled) return

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const htmlPages = await generateAnswerSheetPageHtmls(
          definition,
          multiLayout
        )

        await exportPngFile({
          htmlPages,
          outputPath: pathResult.filePath,
          dpi,
          pageWidthMm: multiLayout.pageWidthMm,
          pageHeightMm: multiLayout.pageHeightMm,
        })
        toast.success("PNGを出力しました")
      } catch {
        // 失敗の通知は MutationCache が出す
      } finally {
        setIsExporting(false)
      }
    },
    [selectSavePath, exportPngFile]
  )

  const printSheet = useCallback(
    async (definition: AnswerSheetDefinition) => {
      try {
        setIsExporting(true)

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const html = await generateAnswerSheetPrintHtml(definition, multiLayout)

        await openPrintDialog({
          html,
          title: definition.name,
          pageSize: {
            width: multiLayout.pageWidthMm,
            height: multiLayout.pageHeightMm,
          },
        })

        toast.success("印刷プレビューを開きました")
      } catch {
        // 失敗の通知は MutationCache が出す
      } finally {
        setIsExporting(false)
      }
    },
    [openPrintDialog]
  )

  return { exportPdf, exportPng, printSheet, isExporting }
}
