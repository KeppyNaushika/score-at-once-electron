/**
 * 試験外成績資料アーカイブ (.coursework) エクスポートのエントリ
 */

import { dialog } from "electron"

import type {
  ExportCourseworkArchiveOptions,
  ExportCourseworkArchiveResult,
} from "../../../../src/types/courseworkArchive.types"
import prisma from "../../prisma/client"
import {
  createCourseworkArchive,
  generateCourseworkExportFileName,
} from "./archiveCreator"

/**
 * 試験外成績資料を .coursework アーカイブとしてエクスポートする。
 * outputPath 未指定なら保存ダイアログを表示する。
 */
export async function exportCoursework(
  options: ExportCourseworkArchiveOptions
): Promise<ExportCourseworkArchiveResult> {
  const coursework = await prisma.coursework.findUnique({
    where: { id: options.courseworkId },
    select: { id: true, name: true },
  })
  if (!coursework) {
    return { success: false, error: "試験外成績資料が見つかりません" }
  }

  let outputPath = options.outputPath
  if (!outputPath) {
    const result = await dialog.showSaveDialog({
      title: "試験外成績資料をエクスポート",
      defaultPath: generateCourseworkExportFileName(coursework.name),
      filters: [{ name: "試験外成績資料", extensions: ["coursework"] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true }
    }
    outputPath = result.filePath
  }

  const created = await createCourseworkArchive(
    coursework.id,
    coursework.name,
    outputPath
  )
  if (!created.success) {
    return { success: false, error: created.error }
  }

  return {
    success: true,
    outputPath,
    manifest: created.manifest,
  }
}
