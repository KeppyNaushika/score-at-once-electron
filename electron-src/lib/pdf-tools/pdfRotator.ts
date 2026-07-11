/**
 * ページ回転ユーティリティ
 */
import * as fs from "fs"
import { degrees, PDFDocument } from "pdf-lib"

import type { RotationDegree } from "@/types/pdfTools.types"

export interface RotateResult {
  success: boolean
  outputPath?: string
  error?: string
}

export interface RotatePageInput {
  pageNumber: number // 1-indexed
  rotation: RotationDegree
}

/**
 * PDFの指定ページを回転
 */
export async function rotatePdfPages(
  filePath: string,
  rotations: RotatePageInput[],
  outputPath: string
): Promise<RotateResult> {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    // owner-password のみの暗号化PDF（印刷/コピー制限）はユーザーパスワード無しで
    // 内容を読めるため、ignoreEncryption で pdf-lib の EncryptedPDFError を回避する。
    // ユーザーパスワード付きPDFはインポート時に復号済み複製へ差し替え済み。
    const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true })

    for (const { pageNumber, rotation } of rotations) {
      const pageIndex = pageNumber - 1
      if (pageIndex < 0 || pageIndex >= pdf.getPageCount()) {
        console.warn(`Invalid page number ${pageNumber}`)
        continue
      }

      const page = pdf.getPage(pageIndex)
      const currentRotation = page.getRotation().angle
      page.setRotation(degrees(currentRotation + rotation))
    }

    const pdfBytes = await pdf.save()
    fs.writeFileSync(outputPath, pdfBytes)

    return { success: true, outputPath }
  } catch (error) {
    console.error("Rotate error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
