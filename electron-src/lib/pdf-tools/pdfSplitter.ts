/**
 * PDF分割ユーティリティ
 * PDFを個別ページに分割
 */
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"

interface SplitResult {
  success: boolean
  outputPaths?: string[]
  error?: string
}

/**
 * PDFを個別ページに分割
 */
export async function splitPdf(
  filePath: string,
  outputDir: string,
  prefix?: string
): Promise<SplitResult> {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    // owner-password のみの暗号化PDF（印刷/コピー制限）はユーザーパスワード無しで
    // 内容を読めるため、ignoreEncryption で pdf-lib の EncryptedPDFError を回避する。
    // ユーザーパスワード付きPDFはインポート時に復号済み複製へ差し替え済み。
    const sourcePdf = await PDFDocument.load(fileBuffer, {
      ignoreEncryption: true,
    })
    const pageCount = sourcePdf.getPageCount()

    // 出力ディレクトリを作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const baseName = prefix || path.basename(filePath, ".pdf")
    const outputPaths: string[] = []

    for (let i = 0; i < pageCount; i++) {
      const pageNumber = i + 1
      const newPdf = await PDFDocument.create()
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [i])
      newPdf.addPage(copiedPage)

      const outputFileName = `${baseName}_page_${pageNumber}.pdf`
      const outputPath = path.join(outputDir, outputFileName)

      const pdfBytes = await newPdf.save()
      fs.writeFileSync(outputPath, pdfBytes)
      outputPaths.push(outputPath)
    }

    return { success: true, outputPaths }
  } catch (error) {
    console.error("PDF split error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
