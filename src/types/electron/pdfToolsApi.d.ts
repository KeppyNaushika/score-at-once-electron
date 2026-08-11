/**
 * PDFツール関連API
 */
import type { PdfPageInput, RotationDegree } from "@/types/pdfTools.types"

export interface PdfToolsAPI {
  pdfTools: {
    mergePdfs: (options: {
      pages: PdfPageInput[]
      outputPath: string
    }) => Promise<string>
    /** 出力ページを1ページ1ファイルのPDFへ書き出す */
    splitPdf: (options: {
      pages: PdfPageInput[]
      outputDir: string
      prefix?: string
    }) => Promise<string[]>
    exportAsPng: (options: {
      imageBuffers: Array<{
        buffer: Buffer
        name: string
        rotation?: RotationDegree
      }>
      outputDir: string
    }) => Promise<string[]>
    /** パスワード保護PDFの復号済み複製（一時ファイル）を復号済みページ画像から作成 */
    createDecryptedCopy: (options: {
      pageImages: Uint8Array[]
      pixelsPerPoint: number
    }) => Promise<string>
    /** 選ばずに閉じた場合は canceled で返る（失敗ではない） */
    selectSavePath: (options: {
      type: "pdf" | "directory"
      defaultName?: string
    }) => Promise<{ canceled: true } | { canceled: false; path: string }>
    /** 選ばずに閉じた場合は canceled で返る（失敗ではない） */
    selectFiles: () => Promise<
      { canceled: true } | { canceled: false; filePaths: string[] }
    >
    getPdfInfo: (filePath: string) => Promise<{
      pageCount: number
      name: string
      /** 1ページ目の幅（ポイント） */
      pageWidth: number
      /** 1ページ目の高さ（ポイント） */
      pageHeight: number
      isEncrypted: boolean
    }>
    /** ドラッグ&ドロップされたFileオブジェクトからパスを取得 */
    getPathForFile: (file: File) => string
  }
}
