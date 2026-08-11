import { webUtils } from "electron"

import type { PdfPageInput, RotationDegree } from "@/types/pdfTools.types"

import { invoke } from "./invoke"

/** PDFツールのIPC API（結合・分割・N-up・PNG出力・ファイル選択） */
export function createPdfToolsApi() {
  return {
    // PDF Tools related
    pdfTools: {
      mergePdfs: (options: { pages: PdfPageInput[]; outputPath: string }) =>
        invoke("pdf-tools:merge-pdfs", options),
      splitPdf: (options: {
        pages: PdfPageInput[]
        outputDir: string
        prefix?: string
      }) => invoke("pdf-tools:split-pdf", options),
      exportAsPng: (options: {
        imageBuffers: Array<{
          buffer: Buffer
          name: string
          rotation?: RotationDegree
        }>
        outputDir: string
      }) => invoke("pdf-tools:export-as-png", options),
      createDecryptedCopy: (options: {
        pageImages: Uint8Array[]
        pixelsPerPoint: number
      }) =>
        invoke("pdf-tools:create-decrypted-copy", options) as Promise<{
          success: boolean
          path?: string
          error?: string
        }>,
      selectSavePath: (options: {
        type: "pdf" | "directory"
        defaultName?: string
      }) => invoke("pdf-tools:select-save-path", options),
      selectFiles: () =>
        invoke("pdf-tools:select-files") as Promise<{
          success: boolean
          filePaths?: string[]
          canceled?: boolean
        }>,
      getPdfInfo: (filePath: string) =>
        invoke("pdf-tools:get-pdf-info", filePath) as Promise<{
          success: boolean
          pageCount?: number
          name?: string
          pageWidth?: number
          pageHeight?: number
          isEncrypted?: boolean
          error?: string
        }>,
      // ドラッグ&ドロップされたFileオブジェクトからパスを取得
      getPathForFile: (file: File) => webUtils.getPathForFile(file),
    },
  }
}
