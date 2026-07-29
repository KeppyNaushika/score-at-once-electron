/**
 * 試験外成績資料アーカイブ (.coursework) インポートのエントリ
 */

import type {
  CourseworkArchiveImportPreview,
  CourseworkArchiveImportResult,
  CourseworkArchiveMatch,
  CourseworkImportOptions,
} from "../../../../src/types/courseworkArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { transformCourseworkToLatest } from "../coursework-transformers"
import type { AnyCourseworkArchiveData } from "../coursework-transformers/types"
import { importCourseworkData } from "./dataCreator"
import { validateCourseworkManifest } from "./manifestValidator"

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
  data: AnyCourseworkArchiveData
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
  for (const coursework of normalized.courseworks) {
    const uuidMatch = await prisma.coursework.findUnique({
      where: { id: coursework.id },
      select: { id: true, name: true },
    })
    const nameCandidates = await prisma.coursework.findMany({
      where: { name: coursework.name },
      select: { id: true, name: true },
    })
    matches.push({
      archiveId: coursework.id,
      name: coursework.name,
      itemCount: normalized.courseworkItems.filter(
        (item) => item.courseworkId === coursework.id
      ).length,
      studentCount: normalized.courseworkStudents.filter(
        (courseworkStudent) => courseworkStudent.courseworkId === coursework.id
      ).length,
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
  data: AnyCourseworkArchiveData,
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
    for (const coursework of normalized.courseworks) {
      void recordAuditLog({
        action: "coursework.import",
        entityType: "Coursework",
        entityId: coursework.id,
        scopeLabel: coursework.name,
        target: coursework.name,
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
