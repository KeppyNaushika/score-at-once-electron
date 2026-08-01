/**
 * PDF Tools IPC ハンドラー
 */
import { BrowserWindow, dialog, ipcMain } from "electron"
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"

import type {
  PdfPageInput,
  PdfToolsResult,
  RotationDegree,
} from "@/types/pdfTools.types"

import { writeDecryptedPdfCopy } from "../lib/pdf-tools/decryptedPdfCopy"
import { mergePdfs } from "../lib/pdf-tools/pdfMerger"
import { splitPdf } from "../lib/pdf-tools/pdfSplitter"
import { exportPagesToPng } from "../lib/pdf-tools/pdfToPng"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** PDFツール（結合・分割・2-in-1・PNG書き出し）に関するIPCチャンネルを登録する */
export function setupPdfToolsHandlers(): void {
  // PDF結合
  registerHandler(
    "pdf-tools:merge-pdfs",
    async (options: {
      pages: PdfPageInput[]
      outputPath: string
    }): Promise<PdfToolsResult> => {
      return await mergePdfs(options.pages, options.outputPath)
    }
  )

  // PDF分割（1ページ1ファイル）
  registerHandler(
    "pdf-tools:split-pdf",
    async (options: {
      pages: PdfPageInput[]
      outputDir: string
      prefix?: string
    }): Promise<PdfToolsResult> => {
      return await splitPdf(options.pages, options.outputDir, options.prefix)
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
      pageWidth?: number
      pageHeight?: number
      isEncrypted?: boolean
      error?: string
    }> => {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` }
      }

      const fileBuffer = fs.readFileSync(filePath)
      // owner-password のみの暗号化PDFでもページ数を取得できるよう ignoreEncryption を付ける
      const pdfDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
      })
      const pageCount = pdfDoc.getPageCount()
      const name = path.basename(filePath)
      // ページサイズは1ページ目を代表値とする（ページごとに異なるPDFもあるため）
      const { width: pageWidth, height: pageHeight } =
        pageCount > 0 ? pdfDoc.getPage(0).getSize() : { width: 0, height: 0 }

      return {
        success: true,
        pageCount,
        name,
        pageWidth,
        pageHeight,
        isEncrypted: pdfDoc.isEncrypted,
      }
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
