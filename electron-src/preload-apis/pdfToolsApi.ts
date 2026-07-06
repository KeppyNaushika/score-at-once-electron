import { ipcRenderer, webUtils } from "electron"

/** PDFツールのIPC API（結合・分割・回転・N-up・PNG出力・ファイル選択） */
export function createPdfToolsApi() {
  return {
    // PDF Tools related
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
      }) => ipcRenderer.invoke("pdf-tools:merge-pdfs", options),
      splitPdf: (options: {
        filePath: string
        outputDir: string
        prefix?: string
      }) => ipcRenderer.invoke("pdf-tools:split-pdf", options),
      rotatePages: (options: {
        filePath: string
        rotations: Array<{
          pageNumber: number
          rotation: 0 | 90 | 180 | 270
        }>
        outputPath: string
      }) => ipcRenderer.invoke("pdf-tools:rotate-pages", options),
      exportAsPng: (options: {
        imageBuffers: Array<{
          buffer: Buffer
          name: string
          rotation?: 0 | 90 | 180 | 270
        }>
        outputDir: string
      }) => ipcRenderer.invoke("pdf-tools:export-as-png", options),
      selectSavePath: (options: {
        type: "pdf" | "directory"
        defaultName?: string
      }) => ipcRenderer.invoke("pdf-tools:select-save-path", options),
      selectFiles: () =>
        ipcRenderer.invoke("pdf-tools:select-files") as Promise<{
          success: boolean
          filePaths?: string[]
          canceled?: boolean
        }>,
      getPdfInfo: (filePath: string) =>
        ipcRenderer.invoke("pdf-tools:get-pdf-info", filePath) as Promise<{
          success: boolean
          pageCount?: number
          name?: string
          error?: string
        }>,
      // ドラッグ&ドロップされたFileオブジェクトからパスを取得
      getPathForFile: (file: File) => webUtils.getPathForFile(file),
    },
  }
}
