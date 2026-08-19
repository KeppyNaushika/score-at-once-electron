/**
 * 解答用紙の書き出し（PDF・PNG）。
 *
 * renderToStaticMarkup でプレビューと同じ React コンポーネントを HTML にし、
 * BrowserWindow + printToPDF / capturePage で出す。
 *
 * **解答用紙と模範解答は必ず両方出す。** 片方だけ出す設定は無い（採点には模範解答が、
 * 配布には解答用紙が要る）。1つのファイルに続けて綴じるか、2つに分けるかだけを選ぶ。
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  exportAnswerSheetPngMutation,
  selectAnswerSheetSavePathMutation,
} from "@/queries/answerSheetBuilder"
import { printHtmlToPdfMutation } from "@/queries/export"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import { MODEL_ANSWER_SUFFIX, withFileNameSuffix } from "../exportFileNames"
import {
  generateAnswerSheetPageHtmls,
  generateAnswerSheetPrintHtml,
} from "../utils/generatePrintHtml"
import { computeMultiPageLayoutFromDefinition } from "./layout/computeMultiPageLayout"

interface ExportOptions {
  /** 解答用紙と模範解答を別のファイルにするか（false なら1つに続けて綴じる） */
  separateFiles: boolean
}

/** 解答用紙のPDF/PNG出力を提供するフック */
export function useAnswerSheetExport() {
  const [isExporting, setIsExporting] = useState(false)
  const { mutateAsync: selectSavePath } = useMutation(
    selectAnswerSheetSavePathMutation()
  )
  const { mutateAsync: printHtmlToPdf } = useMutation(printHtmlToPdfMutation())
  const { mutateAsync: exportPngFile } = useMutation(
    exportAnswerSheetPngMutation()
  )

  const exportPdf = useCallback(
    async (
      definition: AnswerSheetDefinition,
      { separateFiles }: ExportOptions
    ) => {
      try {
        setIsExporting(true)

        const pathResult = await selectSavePath({
          type: "pdf",
          defaultName: `${definition.name}.pdf`,
        })
        if (pathResult.canceled) return

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const pageSize = {
          width: multiLayout.pageWidthMm,
          height: multiLayout.pageHeightMm,
        }
        const margins = { top: 0, bottom: 0, left: 0, right: 0 }

        if (separateFiles) {
          await printHtmlToPdf({
            html: await generateAnswerSheetPrintHtml(definition, multiLayout, [
              "answer-sheet",
            ]),
            filePath: pathResult.filePath,
            pageSize,
            margins,
          })
          await printHtmlToPdf({
            html: await generateAnswerSheetPrintHtml(definition, multiLayout, [
              "model-answer",
            ]),
            filePath: withFileNameSuffix(
              pathResult.filePath,
              MODEL_ANSWER_SUFFIX
            ),
            pageSize,
            margins,
          })
          toast.success("PDFを2つ出力しました（解答用紙・模範解答）")
          return
        }

        await printHtmlToPdf({
          html: await generateAnswerSheetPrintHtml(definition, multiLayout, [
            "answer-sheet",
            "model-answer",
          ]),
          filePath: pathResult.filePath,
          pageSize,
          margins,
        })
        toast.success("PDFを出力しました（解答用紙のあとに模範解答）")
      } catch {
        // 失敗の通知は MutationCache が出す
      } finally {
        setIsExporting(false)
      }
    },
    [selectSavePath, printHtmlToPdf]
  )

  const exportPng = useCallback(
    async (
      definition: AnswerSheetDefinition,
      dpi: number,
      { separateFiles }: ExportOptions
    ) => {
      try {
        setIsExporting(true)

        const pathResult = await selectSavePath({
          type: "png",
          defaultName: `${definition.name}.png`,
        })
        if (pathResult.canceled) return

        const multiLayout = computeMultiPageLayoutFromDefinition(definition)
        const answerSheetPages = await generateAnswerSheetPageHtmls(
          definition,
          multiLayout,
          "answer-sheet"
        )
        const modelAnswerPages = await generateAnswerSheetPageHtmls(
          definition,
          multiLayout,
          "model-answer"
        )
        const size = {
          dpi,
          pageWidthMm: multiLayout.pageWidthMm,
          pageHeightMm: multiLayout.pageHeightMm,
        }

        if (separateFiles) {
          await exportPngFile({
            htmlPages: answerSheetPages,
            outputPath: pathResult.filePath,
            ...size,
          })
          await exportPngFile({
            htmlPages: modelAnswerPages,
            outputPath: withFileNameSuffix(
              pathResult.filePath,
              MODEL_ANSWER_SUFFIX
            ),
            ...size,
          })
          toast.success("PNGを出力しました（解答用紙・模範解答）")
          return
        }

        await exportPngFile({
          htmlPages: [...answerSheetPages, ...modelAnswerPages],
          outputPath: pathResult.filePath,
          ...size,
        })
        toast.success("PNGを出力しました（解答用紙のあとに模範解答）")
      } catch {
        // 失敗の通知は MutationCache が出す
      } finally {
        setIsExporting(false)
      }
    },
    [selectSavePath, exportPngFile]
  )

  return { exportPdf, exportPng, isExporting }
}
