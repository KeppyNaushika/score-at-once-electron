/**
 * PDF Tools IPC ハンドラー
 */
import { BrowserWindow, dialog } from "electron"
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"

import type { PdfPageInput, RotationDegree } from "@/types/pdfTools.types"

import { writeDecryptedPdfCopy } from "../lib/pdf-tools/decryptedPdfCopy"
import { mergePdfs } from "../lib/pdf-tools/pdfMerger"
import { splitPdf } from "../lib/pdf-tools/pdfSplitter"
import { exportPagesToPng } from "../lib/pdf-tools/pdfToPng"
import { type HandlerMap } from "./ipcHandlerUtils"

/** PDFツール（結合・分割・2-in-1・PNG書き出し）に関するIPCチャンネルを登録する */
export const pdfToolsHandlers = {
  // PDF結合
  "pdf-tools:merge-pdfs": async (options: {
    pages: PdfPageInput[]
    outputPath: string
  }): Promise<string> => mergePdfs(options.pages, options.outputPath),

  // PDF分割（1ページ1ファイル）
  "pdf-tools:split-pdf": async (options: {
    pages: PdfPageInput[]
    outputDir: string
    prefix?: string
  }): Promise<string[]> =>
    splitPdf(options.pages, options.outputDir, options.prefix),

  // PNG書き出し
  "pdf-tools:export-as-png": async (options: {
    imageBuffers: {
      buffer: Buffer
      name: string
      rotation?: RotationDegree
    }[]
    outputDir: string
  }): Promise<string[]> =>
    exportPagesToPng(options.imageBuffers, options.outputDir),

  // パスワード保護PDFの復号済み複製を一時ファイルとして作成
  // （pdf-lib は暗号化PDFを読めないため、復号済みページ画像から再構成する）
  "pdf-tools:create-decrypted-copy": (options: {
    pageImages: Uint8Array[]
    pixelsPerPoint: number
  }) => writeDecryptedPdfCopy(options.pageImages, options.pixelsPerPoint),

  // ファイル選択ダイアログ（インポート用）
  "pdf-tools:select-files": async (): Promise<
    { canceled: true } | { canceled: false; filePaths: string[] }
  > => {
    const mainWindow = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "PDFファイルを選択",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      properties: ["openFile", "multiSelections"],
    })

    // 選ばずに閉じたのは失敗ではない
    if (result.canceled) return { canceled: true }

    return { canceled: false, filePaths: result.filePaths }
  },

  // PDFファイル情報を取得
  "pdf-tools:get-pdf-info": async (
    filePath: string
  ): Promise<{
    pageCount: number
    name: string
    pageWidth: number
    pageHeight: number
    isEncrypted: boolean
  }> => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`ファイルが見つかりません: ${filePath}`)
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
      pageCount,
      name,
      pageWidth,
      pageHeight,
      isEncrypted: pdfDoc.isEncrypted,
    }
  },

  // 保存パス選択ダイアログ
  "pdf-tools:select-save-path": async (options: {
    type: "pdf" | "directory"
    defaultName?: string
  }): Promise<{ canceled: true } | { canceled: false; path: string }> => {
    const mainWindow = BrowserWindow.getFocusedWindow()

    if (options.type === "pdf") {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: "PDFを保存",
        defaultPath: options.defaultName || "output.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      })

      // 選ばずに閉じたのは失敗ではない
      if (result.canceled || !result.filePath) return { canceled: true }

      return { canceled: false, path: result.filePath }
    }

    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "保存先フォルダを選択",
      properties: ["openDirectory", "createDirectory"],
    })

    if (result.canceled) return { canceled: true }

    return { canceled: false, path: result.filePaths[0] }
  },
} satisfies HandlerMap
