/**
 * PDFツール関連API
 */
import type { PdfPageInput, RotationDegree } from "@/types/pdfTools.types"

export interface PdfToolsAPI {
  pdfTools: {
    mergePdfs: (options: {
      pages: PdfPageInput[]
      outputPath: string
    }) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    /** 出力ページを1ページ1ファイルのPDFへ書き出す */
    splitPdf: (options: {
      pages: PdfPageInput[]
      outputDir: string
      prefix?: string
    }) => Promise<{ success: boolean; outputPaths?: string[]; error?: string }>
    exportAsPng: (options: {
      imageBuffers: Array<{
        buffer: Buffer
        name: string
        rotation?: RotationDegree
      }>
      outputDir: string
    }) => Promise<{ success: boolean; outputPaths?: string[]; error?: string }>
    /** パスワード保護PDFの復号済み複製（一時ファイル）を復号済みページ画像から作成 */
    createDecryptedCopy: (options: {
      pageImages: Uint8Array[]
      pixelsPerPoint: number
    }) => Promise<{ success: boolean; path?: string; error?: string }>
    selectSavePath: (options: {
      type: "pdf" | "directory"
      defaultName?: string
    }) => Promise<{ success: boolean; path?: string; canceled?: boolean }>
    selectFiles: () => Promise<{
      success: boolean
      filePaths?: string[]
      canceled?: boolean
    }>
    getPdfInfo: (filePath: string) => Promise<{
      success: boolean
      pageCount?: number
      name?: string
      /** 1ページ目の幅（ポイント） */
      pageWidth?: number
      /** 1ページ目の高さ（ポイント） */
      pageHeight?: number
      isEncrypted?: boolean
      error?: string
    }>
    /** ドラッグ&ドロップされたFileオブジェクトからパスを取得 */
    getPathForFile: (file: File) => string
  }
}
