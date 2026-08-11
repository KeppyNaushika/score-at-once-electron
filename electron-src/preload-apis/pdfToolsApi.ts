import { webUtils } from "electron"

import { bind } from "./invoke"

/** PDFツールのIPC API（結合・分割・N-up・PNG出力・ファイル選択） */
export function createPdfToolsApi() {
  return {
    // PDF Tools related
    pdfTools: {
      mergePdfs: bind("pdf-tools:merge-pdfs"),
      splitPdf: bind("pdf-tools:split-pdf"),
      exportAsPng: bind("pdf-tools:export-as-png"),
      createDecryptedCopy: bind("pdf-tools:create-decrypted-copy"),
      selectSavePath: bind("pdf-tools:select-save-path"),
      selectFiles: bind("pdf-tools:select-files"),
      getPdfInfo: bind("pdf-tools:get-pdf-info"),
      // ドラッグ&ドロップされたFileオブジェクトからパスを取得
      getPathForFile: (file: File) => webUtils.getPathForFile(file),
    },
  }
}
