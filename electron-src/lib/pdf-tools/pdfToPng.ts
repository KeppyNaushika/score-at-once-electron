/**
 * PDF→PNG変換ユーティリティ
 * PDFページをPNG画像として出力
 */
import * as fs from "fs"
import * as fsPromises from "fs/promises"
import * as path from "path"

import type { RotationDegree } from "@/types/pdfTools.types"

import { encodePng, rotateToPng } from "../imageOps"

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
    // 回転を適用
    const png = rotation
      ? await rotateToPng(buffer, rotation)
      : await encodePng(buffer)

    const outputPath = path.join(outputDir, name)
    await fsPromises.writeFile(outputPath, png)
    outputPaths.push(outputPath)
  }

  return outputPaths
}
