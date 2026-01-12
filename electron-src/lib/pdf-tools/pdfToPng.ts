/**
 * PDF→PNG変換ユーティリティ
 * PDFページをPNG画像として出力
 */
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"

import type { RotationDegree } from "@/types/pdfTools.types"

export interface PngExportInput {
  filePath: string
  pageNumber: number // 1-indexed
  rotation?: RotationDegree
}

export interface PngExportResult {
  success: boolean
  outputPaths?: string[]
  error?: string
}

/**
 * PDFページをPNGとして出力
 * Note: レンダラープロセスでPDF.jsを使用してCanvas経由で変換する必要がある
 * このユーティリティは既にレンダリングされた画像データを受け取る想定
 */
export async function exportPagesToPng(
  imageBuffers: { buffer: Buffer; name: string; rotation?: RotationDegree }[],
  outputDir: string
): Promise<PngExportResult> {
  try {
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

    return { success: true, outputPaths }
  } catch (error) {
    console.error("PNG export error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 既存の画像ファイルを回転してコピー
 */
export async function rotateAndCopyImages(
  inputs: { sourcePath: string; rotation: RotationDegree; outputPath: string }[]
): Promise<PngExportResult> {
  try {
    const outputPaths: string[] = []

    for (const { sourcePath, rotation, outputPath } of inputs) {
      let image = sharp(sourcePath)

      if (rotation !== 0) {
        image = image.rotate(rotation)
      }

      // 出力ディレクトリを作成
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      await image.png().toFile(outputPath)
      outputPaths.push(outputPath)
    }

    return { success: true, outputPaths }
  } catch (error) {
    console.error("Image rotate/copy error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
