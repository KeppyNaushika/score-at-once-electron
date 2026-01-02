/**
 * ページ回転ユーティリティ
 */
import { PDFDocument, degrees } from "pdf-lib"
import * as fs from "fs"
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
    const pdf = await PDFDocument.load(fileBuffer)

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
