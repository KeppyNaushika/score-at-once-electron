/**
 * PDFツール関連API
 */
export interface PdfToolsAPI {
  pdfTools: {
    mergePdfs: (options: {
      pages: Array<{
        filePath: string
        pageNumber: number
        rotation?: 0 | 90 | 180 | 270
        // 2-in-1用
        isNUpCombined?: boolean
        combinedPages?: number[]
        nUpLayout?: "2x1" | "1x2"
      }>
      outputPath: string
    }) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    splitPdf: (options: {
      filePath: string
      outputDir: string
      prefix?: string
    }) => Promise<{ success: boolean; outputPaths?: string[]; error?: string }>
    rotatePages: (options: {
      filePath: string
      rotations: Array<{ pageNumber: number; rotation: 0 | 90 | 180 | 270 }>
      outputPath: string
    }) => Promise<{ success: boolean; outputPath?: string; error?: string }>
    exportAsPng: (options: {
      imageBuffers: Array<{
        buffer: Buffer
        name: string
        rotation?: 0 | 90 | 180 | 270
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
      error?: string
    }>
    /** ドラッグ&ドロップされたFileオブジェクトからパスを取得 */
    getPathForFile: (file: File) => string
  }
}
