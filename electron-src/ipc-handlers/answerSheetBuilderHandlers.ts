/**
 * 解答用紙作成機能のIPCハンドラー
 */

import { BrowserWindow, dialog, ipcMain, shell } from "electron"
import fs from "fs"
import os from "os"
import path from "path"
import sharp from "sharp"

import type {
  AnswerSheetDefinition,
  ASBConvertToExamArgs,
  ASBExportPdfArgs,
  ASBExportPngArgs,
  ASBPrintArgs,
} from "../../types/answerSheetBuilder.types"
import { convertToExam } from "../lib/answer-sheet-builder/examConverter"
import {
  deleteAsbDefinition,
  getAsbDefinition,
  listAsbDefinitions,
  saveAsbDefinition,
} from "../lib/prisma/asbDefinition"

export function setupAnswerSheetBuilderHandlers(): void {
  // 定義一覧取得
  ipcMain.handle("asb:list-definitions", async (_event, userId: string) => {
    try {
      const data = await listAsbDefinitions(userId)
      return { success: true, data }
    } catch (error) {
      console.error("asb:list-definitions error:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "定義一覧の取得に失敗しました",
      }
    }
  })

  // 定義読込
  ipcMain.handle("asb:load-definition", async (_event, id: string) => {
    try {
      const definition = await getAsbDefinition(id)
      if (!definition) {
        return { success: false, error: "定義が見つかりません" }
      }
      return { success: true, data: definition }
    } catch (error) {
      console.error("asb:load-definition error:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "定義の読込に失敗しました",
      }
    }
  })

  // 定義保存
  ipcMain.handle(
    "asb:save-definition",
    async (_event, definition: AnswerSheetDefinition, userId: string) => {
      try {
        await saveAsbDefinition(definition, userId)
        return { success: true }
      } catch (error) {
        console.error("asb:save-definition error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "定義の保存に失敗しました",
        }
      }
    }
  )

  // 定義削除
  ipcMain.handle("asb:delete-definition", async (_event, id: string) => {
    try {
      const deleted = await deleteAsbDefinition(id)
      return { success: deleted }
    } catch (error) {
      console.error("asb:delete-definition error:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "定義の削除に失敗しました",
      }
    }
  })

  // PDF出力: HTMLを受け取り → 一時ファイル → BrowserWindow → printToPDF
  ipcMain.handle("asb:export-pdf", async (_event, args: ASBExportPdfArgs) => {
    let tempHtmlPath: string | null = null
    let win: BrowserWindow | null = null
    try {
      tempHtmlPath = path.join(os.tmpdir(), `asb-pdf-${Date.now()}.html`)
      fs.writeFileSync(tempHtmlPath, args.html, "utf-8")

      win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true },
      })
      await win.loadFile(tempHtmlPath)

      // レンダリング完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 500))

      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: {
          width: args.pageWidthMm * 1000, // microns
          height: args.pageHeightMm * 1000,
        },
        printBackground: true,
        margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 },
      })

      const outputDir = path.dirname(args.outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      fs.writeFileSync(args.outputPath, pdfBuffer)

      return { success: true, filePath: args.outputPath }
    } catch (error) {
      console.error("asb:export-pdf error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "PDF出力に失敗しました",
      }
    } finally {
      win?.destroy()
      if (tempHtmlPath) {
        try {
          fs.unlinkSync(tempHtmlPath)
        } catch {
          // ignore
        }
      }
    }
  })

  // PNG出力: SVG文字列を受け取り → sharp でラスタライズ
  ipcMain.handle("asb:export-png", async (_event, args: ASBExportPngArgs) => {
    try {
      const widthPx = Math.round((args.pageWidthMm / 25.4) * args.dpi)
      const heightPx = Math.round((args.pageHeightMm / 25.4) * args.dpi)

      const outputDir = path.dirname(args.outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      if (args.svgStrings.length === 1) {
        const svgBuffer = Buffer.from(args.svgStrings[0])
        await sharp(svgBuffer)
          .resize(widthPx, heightPx)
          .png()
          .toFile(args.outputPath)
      } else {
        const ext = path.extname(args.outputPath)
        const base = args.outputPath.slice(0, -ext.length)
        for (let i = 0; i < args.svgStrings.length; i++) {
          const pagePath = `${base}-${i + 1}${ext}`
          const svgBuffer = Buffer.from(args.svgStrings[i])
          await sharp(svgBuffer)
            .resize(widthPx, heightPx)
            .png()
            .toFile(pagePath)
        }
      }

      return { success: true, filePath: args.outputPath }
    } catch (error) {
      console.error("asb:export-png error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "PNG出力に失敗しました",
      }
    }
  })

  // 保存先ダイアログ
  ipcMain.handle(
    "asb:select-save-path",
    async (_event, options: { type: "pdf" | "png"; defaultName?: string }) => {
      try {
        const filters =
          options.type === "pdf"
            ? [{ name: "PDF", extensions: ["pdf"] }]
            : [{ name: "PNG", extensions: ["png"] }]

        const result = await dialog.showSaveDialog({
          title: `解答用紙を${options.type.toUpperCase()}として保存`,
          defaultPath: options.defaultName,
          filters,
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }
        return { success: true, filePath: result.filePath }
      } catch (error) {
        console.error("asb:select-save-path error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "保存先選択に失敗しました",
        }
      }
    }
  )

  // 試験変換: multiPageLayout + SVG文字列を受け取り
  ipcMain.handle(
    "asb:convert-to-exam",
    async (_event, args: ASBConvertToExamArgs) => {
      try {
        const result = await convertToExam(
          args.definition,
          args.userId,
          args.multiPageLayout,
          args.answerSheetSvgStrings,
          args.modelAnswerSvgStrings
        )
        return result
      } catch (error) {
        console.error("asb:convert-to-exam error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "試験変換に失敗しました",
        }
      }
    }
  )

  // 印刷: HTMLを受け取り → printToPDF → プレビューで開く
  ipcMain.handle("asb:print", async (_event, args: ASBPrintArgs) => {
    let tempHtmlPath: string | null = null
    let tempPdfPath: string | null = null
    let win: BrowserWindow | null = null
    try {
      tempHtmlPath = path.join(os.tmpdir(), `asb-print-${Date.now()}.html`)
      tempPdfPath = path.join(os.tmpdir(), `asb-print-${Date.now()}.pdf`)
      fs.writeFileSync(tempHtmlPath, args.html, "utf-8")

      win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true },
      })
      await win.loadFile(tempHtmlPath)

      // レンダリング完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 500))

      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: {
          width: args.pageWidthMm * 1000, // microns
          height: args.pageHeightMm * 1000,
        },
        printBackground: true,
        margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 },
      })

      fs.writeFileSync(tempPdfPath, pdfBuffer)
      await shell.openPath(tempPdfPath)

      return { success: true }
    } catch (error) {
      console.error("asb:print error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "印刷に失敗しました",
      }
    } finally {
      win?.destroy()
      if (tempHtmlPath) {
        try {
          fs.unlinkSync(tempHtmlPath)
        } catch {
          // ignore
        }
      }
      // tempPdfPath はプレビュー中なので削除しない
    }
  })
}
