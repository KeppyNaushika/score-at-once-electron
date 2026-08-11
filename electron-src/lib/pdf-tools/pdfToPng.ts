/**
 * PDF→PNG変換ユーティリティ
 * PDFページをPNG画像として出力
 */
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"

import type { RotationDegree } from "@/types/pdfTools.types"

/**
 * PDFページをPNGとして出力
 * Note: レンダラープロセスでPDF.jsを使用してCanvas経由で変換する必要がある
 * このユーティリティは既にレンダリングされた画像データを受け取る想定
 */
export async function exportPagesToPng(
  imageBuffers: { buffer: Buffer; name: string; rotation?: RotationDegree }[],
  outputDir: string
): Promise<string[]> {
  // 出力ディレクトリを作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPaths: string[] = []

  for (const { buffer, name, rotation } of imageBuffers) {
    let image = sharp(buffer)

    // 回転を適用
    if (rotation) {
      image = image.rotate(rotation)
    }

    const outputPath = path.join(outputDir, name)
    await image.png().toFile(outputPath)
    outputPaths.push(outputPath)
  }

  return outputPaths
}
