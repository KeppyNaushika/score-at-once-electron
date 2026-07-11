/**
 * パスワード保護PDFの復号済み複製の生成
 *
 * pdf-lib はパスワード付きPDFを読み込めないため、レンダラー側で pdf.js が
 * パスワード復号してレンダリングしたページ画像から、保護なしのPDFを一時ファイル
 * として再構成する。以後の結合・分割・回転はこの複製のパスに対して行う。
 */
import { randomUUID } from "crypto"
import { app } from "electron"
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"

/** 復号済み複製を書き出す一時ディレクトリ */
function decryptedCopyDir(): string {
  return path.join(app.getPath("temp"), "score-at-once", "pdf-tools")
}

/**
 * 復号済み複製の一時ディレクトリをまるごと削除する。
 *
 * 複製は取り込み後の書き出しまでパス参照され続けるため即時削除できない。
 * 代わりにアプリ起動時に呼び、前回セッション（やクラッシュ）で残った複製を一括回収する。
 * この時点では現セッションの複製はまだ存在しないため、使用中ファイルを消す心配がない。
 */
export function cleanupDecryptedPdfCopies(): void {
  fs.rmSync(decryptedCopyDir(), { recursive: true, force: true })
}

/**
 * 復号済みページ画像（PNG）から一時PDFを作成し、そのパスを返す。
 *
 * @param pageImages ページ順のPNG画像
 * @param pixelsPerPoint 画像レンダリング倍率（1ポイントあたりのピクセル数）。
 *   ページ寸法を元PDFと同じ物理サイズ（ポイント）に戻すために使う。
 */
export async function writeDecryptedPdfCopy(
  pageImages: Uint8Array[],
  pixelsPerPoint: number
): Promise<string> {
  const pdfDoc = await PDFDocument.create()

  for (const pageImage of pageImages) {
    const embeddedImage = await pdfDoc.embedPng(pageImage)
    const pageWidth = embeddedImage.width / pixelsPerPoint
    const pageHeight = embeddedImage.height / pixelsPerPoint
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    })
  }

  const outputDir = decryptedCopyDir()
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `decrypted-${randomUUID()}.pdf`)
  fs.writeFileSync(outputPath, await pdfDoc.save())
  return outputPath
}
