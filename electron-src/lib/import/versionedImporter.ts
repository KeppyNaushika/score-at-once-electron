/**
 * バージョン別インポーター
 *
 * 連鎖変換パターンを使用してアーカイブを最新形式に変換
 *
 * @see docs/schema-history/README.md
 */

import type {
  ArchiveClassesData,
  ArchiveManifest,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
} from "../../../types/projectArchive.types"
import type {
  ArchiveData,
  ArchiveVersion,
  ChainTransformResult,
} from "./transformers"
import {
  CURRENT_VERSION,
  detectArchiveVersion,
  isSupportedVersion,
  requiresTransformation,
  SUPPORTED_VERSIONS,
  transformToLatest,
} from "./transformers"

// =============================================================================
// Re-exports from transformers
// =============================================================================

export {
  CURRENT_VERSION,
  detectArchiveVersion,
  isSupportedVersion,
  requiresTransformation,
  SUPPORTED_VERSIONS,
}

export type { ArchiveVersion }

// =============================================================================
// Extended Types for Archive Processing
// =============================================================================

/**
 * 展開されたアーカイブデータ
 */
export interface ExtractedArchiveData {
  manifest: ArchiveManifest
  projectData: ArchiveProjectData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  tempDir: string
  /** マスター画像のパス一覧 (展開後のフルパス) */
  masterImagePaths: string[]
  /** 答案画像のパス一覧 (展開後のフルパス) */
  answerSheetPaths: string[]
}

/**
 * 変換済みアーカイブデータ
 */
export interface TransformedArchiveData extends ExtractedArchiveData {
  /** 変換前のバージョン */
  originalVersion: ArchiveVersion | "unknown"
  /** 変換時の警告 */
  transformWarnings: string[]
}

// =============================================================================
// Archive Transformation
// =============================================================================

/**
 * アーカイブデータを最新形式に変換
 *
 * 連鎖変換パターンを使用:
 * 1.0.0 → 1.1.0 → 1.2.0
 *
 * @param data - 展開されたアーカイブデータ
 * @returns 変換済みデータ
 */
export function transformArchiveData(
  data: ExtractedArchiveData
): TransformedArchiveData {
  const originalVersion = detectArchiveVersion(data.manifest)

  if (originalVersion === "unknown") {
    // 未知のバージョンは警告付きでパススルー
    console.warn(
      `Unknown archive version: ${data.manifest.version}. ` +
        `Attempting to process as ${CURRENT_VERSION}.`
    )

    return {
      ...data,
      originalVersion: "unknown",
      transformWarnings: [
        `アーカイブバージョン ${data.manifest.version} は認識できません。` +
          `処理は続行しますが、データの整合性を確認してください。`,
      ],
    }
  }

  // 変換不要の場合
  if (originalVersion === CURRENT_VERSION) {
    return {
      ...data,
      originalVersion,
      transformWarnings: [],
    }
  }

  // 連鎖変換を実行
  const archiveData: ArchiveData = {
    manifest: data.manifest,
    projectData: data.projectData,
    studentsData: data.studentsData,
    classesData: data.classesData,
    usersData: data.usersData,
    subtotalsData: data.subtotalsData,
    scoresData: data.scoresData,
  }

  const result: ChainTransformResult = transformToLatest(archiveData)

  // ログ出力
  if (result.appliedTransformations.length > 0) {
    const transformPath = result.appliedTransformations
      .map((t) => `${t.from}→${t.to}`)
      .join(" → ")
    console.info(`Archive transformation applied: ${transformPath}`)
  }

  return {
    manifest: result.data.manifest,
    projectData: result.data.projectData,
    studentsData: result.data.studentsData,
    classesData: result.data.classesData,
    usersData: result.data.usersData,
    subtotalsData: result.data.subtotalsData,
    scoresData: result.data.scoresData,
    tempDir: data.tempDir,
    masterImagePaths: data.masterImagePaths,
    answerSheetPaths: data.answerSheetPaths,
    originalVersion: result.originalVersion,
    transformWarnings: result.warnings,
  }
}
