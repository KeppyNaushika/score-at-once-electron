/**
 * 試験外成績資料アーカイブ (.coursework) インポートのエントリ
 */

import type {
  CourseworkArchiveData,
  CourseworkArchiveImportPreview,
  CourseworkArchiveImportResult,
  CourseworkArchiveMatch,
  CourseworkImportOptions,
} from "../../../../src/types/courseworkArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { importCourseworkData } from "./dataCreator"
import { validateCourseworkManifest } from "./manifestValidator"
import { transformCourseworkToLatest } from "./transformers"

export type { ExtractedCourseworkArchive } from "./archiveExtractor"
export {
  cleanupCourseworkTempDir,
  extractCourseworkArchive,
  readCourseworkManifestOnly,
} from "./archiveExtractor"
export { importCourseworkData } from "./dataCreator"

/**
 * インポート前のプレビュー（資料ごとの照合候補）を作る。
 */
export async function previewCourseworkImport(
  data: CourseworkArchiveData
): Promise<{
  success: boolean
  preview?: CourseworkArchiveImportPreview
  error?: string
}> {
  const validation = validateCourseworkManifest(data.manifest)
  if (!validation.compatible || !validation.manifest) {
    return { success: false, error: validation.error }
  }

  const { data: normalized, warnings } = transformCourseworkToLatest(data)

  const matches: CourseworkArchiveMatch[] = []
  for (const cw of normalized.courseworks) {
    const uuidMatch = await prisma.coursework.findUnique({
      where: { id: cw.id },
      select: { id: true, name: true },
    })
    const nameCandidates = await prisma.coursework.findMany({
      where: { name: cw.name },
      select: { id: true, name: true },
    })
    matches.push({
      archiveId: cw.id,
      name: cw.name,
      itemCount: cw.items.length,
      studentCount: cw.students.length,
      uuidMatch: uuidMatch ?? null,
      nameCandidates,
    })
  }

  return {
    success: true,
    preview: {
      manifest: validation.manifest,
      matches,
      warnings: [...validation.warnings, ...warnings],
    },
  }
}

/**
 * 試験外成績資料アーカイブをインポートする（単体・新規トランザクション）。
 */
export async function importCourseworkArchive(
  data: CourseworkArchiveData,
  options: CourseworkImportOptions = {}
): Promise<CourseworkArchiveImportResult> {
  try {
    const validation = validateCourseworkManifest(data.manifest)
    if (!validation.compatible) {
      return { success: false, error: validation.error }
    }
    const { data: normalized, warnings: transformWarnings } =
      transformCourseworkToLatest(data)

    const result = await prisma.$transaction(async (tx) => {
      return importCourseworkData(tx, normalized, {
        allowCreate: true,
        ...options,
      })
    })

    // 監査ログ（ベストエフォート）
    for (const cw of normalized.courseworks) {
      void recordAuditLog({
        action: "coursework.import",
        entityType: "Coursework",
        entityId: cw.id,
        scopeLabel: cw.name,
        target: cw.name,
      })
    }

    return {
      success: true,
      createdCourseworkIds: result.createdCourseworkIds,
      warnings: [...transformWarnings, ...result.warnings],
    }
  } catch (error) {
    console.error("Error importing coursework archive:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "インポートに失敗しました",
    }
  }
}
