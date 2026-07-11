/**
 * PDF Tools IPC ハンドラー
 */
import { BrowserWindow, dialog, ipcMain } from "electron"
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"

import type { PdfToolsResult, RotationDegree } from "@/types/pdfTools.types"

import { writeDecryptedPdfCopy } from "../lib/pdf-tools/decryptedPdfCopy"
import { type MergePageInput, mergePdfs } from "../lib/pdf-tools/pdfMerger"
import {
  type RotatePageInput,
  rotatePdfPages,
} from "../lib/pdf-tools/pdfRotator"
import { splitPdf } from "../lib/pdf-tools/pdfSplitter"
import { exportPagesToPng } from "../lib/pdf-tools/pdfToPng"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** PDFツール（結合・分割・回転・2-in-1・PNG書き出し）に関するIPCチャンネルを登録する */
export function setupPdfToolsHandlers(): void {
  // PDF結合
  registerHandler(
    "pdf-tools:merge-pdfs",
    async (options: {
      pages: MergePageInput[]
      outputPath: string
    }): Promise<PdfToolsResult> => {
      return await mergePdfs(options.pages, options.outputPath)
    }
  )

  // PDF分割
  registerHandler(
    "pdf-tools:split-pdf",
    async (options: {
      filePath: string
      outputDir: string
      prefix?: string
    }): Promise<PdfToolsResult> => {
      return await splitPdf(options.filePath, options.outputDir, options.prefix)
    }
  )

  // ページ回転
  registerHandler(
    "pdf-tools:rotate-pages",
    async (options: {
      filePath: string
      rotations: RotatePageInput[]
      outputPath: string
    }): Promise<PdfToolsResult> => {
      return await rotatePdfPages(
        options.filePath,
        options.rotations,
        options.outputPath
      )
    }
  )

  // PNG書き出し
  registerHandler(
    "pdf-tools:export-as-png",
    async (options: {
      imageBuffers: {
        buffer: Buffer
        name: string
        rotation?: RotationDegree
      }[]
      outputDir: string
    }): Promise<PdfToolsResult> => {
      return await exportPagesToPng(options.imageBuffers, options.outputDir)
    }
  )

  // パスワード保護PDFの復号済み複製を一時ファイルとして作成
  // （pdf-lib は暗号化PDFを読めないため、復号済みページ画像から再構成する）
  registerSafeHandler(
    "pdf-tools:create-decrypted-copy",
    async (options: {
      pageImages: Uint8Array[]
      pixelsPerPoint: number
    }): Promise<{ success: boolean; path?: string; error?: string }> => {
      const outputPath = await writeDecryptedPdfCopy(
        options.pageImages,
        options.pixelsPerPoint
      )
      return { success: true, path: outputPath }
    }
  )

  // ファイル選択ダイアログ（インポート用）
  // NOTE: Uses BrowserWindow.getFocusedWindow(), kept as manual ipcMain.handle
  ipcMain.handle(
    "pdf-tools:select-files",
    async (): Promise<{
      success: boolean
      filePaths?: string[]
      canceled?: boolean
    }> => {
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
        console.error("Error in IPC handler [pdf-tools:select-files]:", error)
        return { success: false }
      }
    }
  )

  // PDFファイル情報を取得
  registerSafeHandler(
    "pdf-tools:get-pdf-info",
    async (
      filePath: string
    ): Promise<{
      success: boolean
      pageCount?: number
      name?: string
      error?: string
    }> => {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` }
      }

      const fileBuffer = fs.readFileSync(filePath)
      const pdfDoc = await PDFDocument.load(fileBuffer)
      const pageCount = pdfDoc.getPageCount()
      const name = path.basename(filePath)

      return { success: true, pageCount, name }
    }
  )

  // 保存パス選択ダイアログ
  // NOTE: Uses BrowserWindow.getFocusedWindow(), kept as manual ipcMain.handle
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
        console.error(
          "Error in IPC handler [pdf-tools:select-save-path]:",
          error
        )
        return {
          success: false,
          canceled: false,
        }
      }
    }
  )
}
