/**
 * PDF→PNG変換ユーティリティ
 * PDFページをPNG画像として出力
 */
import * as fsPromises from "fs/promises"

import { PNG_PAGES_ZIP_FILE_NAME } from "@/lib/outputResultText"
import type { RotationDegree } from "@/types/pdfTools.types"

import { encodePng, rotateToPng } from "../imageOps"
import { createMultiFileOutput } from "../multiFileOutput"

/**
 * PDFページをPNGとして出力
 * Note: レンダラープロセスでPDF.jsを使用してCanvas経由で変換する必要がある
 * このユーティリティは既にレンダリングされた画像データを受け取る想定。
 * web 版は1ファイルずつ書かず、`outputDir` の下の zip 1つにまとめる（`multiFileOutput.ts`）
 */
export async function exportPagesToPng(
  imageBuffers: { buffer: Buffer; name: string; rotation?: RotationDegree }[],
  outputDir: string
): Promise<string[]> {
  // 出力ディレクトリを作成
  await fsPromises.mkdir(outputDir, { recursive: true })

  const pageFilesOutput = createMultiFileOutput(
    outputDir,
    PNG_PAGES_ZIP_FILE_NAME
  )
  const outputPaths: string[] = []

  for (const { buffer, name, rotation } of imageBuffers) {
    // 回転を適用
    const png = rotation
      ? await rotateToPng(buffer, rotation)
      : await encodePng(buffer)

    outputPaths.push(await pageFilesOutput.add(name, png))
  }
  await pageFilesOutput.finish()

  return outputPaths
}
