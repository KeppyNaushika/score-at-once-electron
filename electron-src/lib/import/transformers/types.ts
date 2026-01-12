/**
 * アーカイブ変換器の型定義
 *
 * 連鎖変換パターン: 1.0.0 → 1.1.0 → 1.2.0 → ...
 * 各変換器は「次のバージョンへの変換」のみを担当する
 */

import type {
  ArchiveClassesData,
  ArchiveManifest,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
} from "../../../../types/projectArchive.types"

// =============================================================================
// Archive Version Types
// =============================================================================

/**
 * サポートされているアーカイブバージョン
 *
 * - 1.0.0: v0.2.x (UserProject.invitedAt/invitedBy なし, PageImage使用)
 * - 1.1.0: v0.3.x (UserProject完全対応, ProjectClass追加, PageImage使用)
 * - 1.2.0: v0.4.x (MasterImage/StudentAnswerImage分離, userId/studentId非NULL)
 * - 1.3.0: v0.5.x (Student.studentId → Student.studentNumber リネーム)
 */
export type ArchiveVersion = "1.0.0" | "1.1.0" | "1.2.0" | "1.3.0"

/** 現在の最新バージョン */
export const CURRENT_VERSION: ArchiveVersion = "1.3.0"

/** サポートされている全バージョン（古い順） */
export const SUPPORTED_VERSIONS: readonly ArchiveVersion[] = [
  "1.0.0",
  "1.1.0",
  "1.2.0",
  "1.3.0",
] as const

// =============================================================================
// Transformer Interface
// =============================================================================

/**
 * アーカイブデータ（変換対象）
 */
export interface ArchiveData {
  manifest: ArchiveManifest
  projectData: ArchiveProjectData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
}

/**
 * 変換結果
 */
export interface TransformResult {
  /** 変換後のデータ */
  data: ArchiveData
  /** 変換時の警告メッセージ */
  warnings: string[]
}

/**
 * バージョン変換器インターフェース
 *
 * 各変換器は「特定のバージョンから次のバージョンへ」の変換を担当する
 */
export interface VersionTransformer {
  /** 変換元バージョン */
  readonly fromVersion: ArchiveVersion
  /** 変換先バージョン */
  readonly toVersion: ArchiveVersion

  /**
   * アーカイブデータを次のバージョンに変換
   *
   * @param data - 変換元のアーカイブデータ
   * @returns 変換結果（データと警告）
   */
  transform(data: ArchiveData): TransformResult
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * 変換チェーン構築用のバージョンペア
 */
export interface VersionPair {
  from: ArchiveVersion
  to: ArchiveVersion
}

/**
 * 変換チェーンの実行結果
 */
export interface ChainTransformResult {
  /** 変換後のデータ */
  data: ArchiveData
  /** 元のバージョン */
  originalVersion: ArchiveVersion
  /** 最終バージョン */
  finalVersion: ArchiveVersion
  /** 適用された変換のリスト */
  appliedTransformations: VersionPair[]
  /** 累積された警告メッセージ */
  warnings: string[]
}
