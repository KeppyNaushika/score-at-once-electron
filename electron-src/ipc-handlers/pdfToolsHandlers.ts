/**
 * PDF Tools IPC ハンドラー
 */
import { ipcMain, dialog, BrowserWindow } from "electron"
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"
import { mergePdfs, type MergePageInput } from "../lib/pdf-tools/pdfMerger"
import { splitPdf } from "../lib/pdf-tools/pdfSplitter"
import { applyNUp } from "../lib/pdf-tools/pdfNUp"
import { rotatePdfPages, type RotatePageInput } from "../lib/pdf-tools/pdfRotator"
import { exportPagesToPng } from "../lib/pdf-tools/pdfToPng"
import type {
  MergePdfsOptions,
  SplitPdfOptions,
  NUpOptions,
  ExportPngOptions,
  PdfToolsResult,
  RotationDegree,
} from "@/types/pdfTools.types"

export function setupPdfToolsHandlers(): void {
  // PDF結合
  ipcMain.handle(
    "pdf-tools:merge-pdfs",
    async (
      _event,
      options: {
        pages: MergePageInput[]
        outputPath: string
      }
    ): Promise<PdfToolsResult> => {
      console.log("pdf-tools:merge-pdfs received:", {
        pagesCount: options.pages?.length,
        firstPage: options.pages?.[0],
        outputPath: options.outputPath,
      })
      return await mergePdfs(options.pages, options.outputPath)
    }
  )

  // PDF分割
  ipcMain.handle(
    "pdf-tools:split-pdf",
    async (
      _event,
      options: {
        filePath: string
        outputDir: string
        prefix?: string
      }
    ): Promise<PdfToolsResult> => {
      return await splitPdf(options.filePath, options.outputDir, options.prefix)
    }
  )

  // 2-in-1変換
  ipcMain.handle(
    "pdf-tools:apply-nup",
    async (
      _event,
      options: NUpOptions
    ): Promise<PdfToolsResult> => {
      return await applyNUp(
        options.filePath,
        options.layout,
        options.order,
        options.outputPath
      )
    }
  )

  // ページ回転
  ipcMain.handle(
    "pdf-tools:rotate-pages",
    async (
      _event,
      options: {
        filePath: string
        rotations: RotatePageInput[]
        outputPath: string
      }
    ): Promise<PdfToolsResult> => {
      return await rotatePdfPages(
        options.filePath,
        options.rotations,
        options.outputPath
      )
    }
  )

  // PNG書き出し
  ipcMain.handle(
    "pdf-tools:export-as-png",
    async (
      _event,
      options: {
        imageBuffers: { buffer: Buffer; name: string; rotation?: RotationDegree }[]
        outputDir: string
      }
    ): Promise<PdfToolsResult> => {
      return await exportPagesToPng(options.imageBuffers, options.outputDir)
    }
  )

  // ファイル選択ダイアログ（インポート用）
  ipcMain.handle(
    "pdf-tools:select-files",
    async (): Promise<{ success: boolean; filePaths?: string[]; canceled?: boolean }> => {
      try {
        const mainWindow = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(mainWindow!, {
          title: "PDFファイルを選択",
          filters: [{ name: "PDF", extensions: ["pdf"] }],
          properties: ["openFile", "multiSelections"],
        })

        if (result.canceled) {
          return { success: true, canceled: true }
        }

        return { success: true, filePaths: result.filePaths }
      } catch (error) {
        console.error("File select dialog error:", error)
        return { success: false }
      }
    }
  )

  // PDFファイル情報を取得
  ipcMain.handle(
    "pdf-tools:get-pdf-info",
    async (
      _event,
      filePath: string
    ): Promise<{
      success: boolean
      pageCount?: number
      name?: string
      error?: string
    }> => {
      try {
        if (!fs.existsSync(filePath)) {
          return { success: false, error: `File not found: ${filePath}` }
        }

        const fileBuffer = fs.readFileSync(filePath)
        const pdfDoc = await PDFDocument.load(fileBuffer)
        const pageCount = pdfDoc.getPageCount()
        const name = path.basename(filePath)

        return { success: true, pageCount, name }
      } catch (error) {
        console.error("PDF info error:", error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }
  )

  // 保存パス選択ダイアログ
  ipcMain.handle(
    "pdf-tools:select-save-path",
    async (
      _event,
      options: {
        type: "pdf" | "directory"
        defaultName?: string
      }
    ): Promise<{ success: boolean; path?: string; canceled?: boolean }> => {
      try {
        const mainWindow = BrowserWindow.getFocusedWindow()

        if (options.type === "pdf") {
          const result = await dialog.showSaveDialog(mainWindow!, {
            title: "PDFを保存",
            defaultPath: options.defaultName || "output.pdf",
            filters: [{ name: "PDF", extensions: ["pdf"] }],
          })

          if (result.canceled) {
            return { success: true, canceled: true }
          }

          return { success: true, path: result.filePath }
        } else {
          const result = await dialog.showOpenDialog(mainWindow!, {
            title: "保存先フォルダを選択",
            properties: ["openDirectory", "createDirectory"],
          })

          if (result.canceled) {
            return { success: true, canceled: true }
          }

          return { success: true, path: result.filePaths[0] }
        }
      } catch (error) {
        console.error("Dialog error:", error)
        return {
          success: false,
          canceled: false,
        }
      }
    }
  )
}
