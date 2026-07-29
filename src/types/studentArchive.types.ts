/**
 * 生徒・学級アーカイブ エクスポート/インポート機能の型定義
 */

import type {
  CategoryIdIntegrationConfig,
  PreMatchingResult,
  UpdateDecisions,
} from "./examArchive.types"

// =============================================================================
// バージョン（トランスフォーマー機構用）
// =============================================================================

/** アーカイブバージョン（追加時にユニオンへ足す） */
export type StudentArchiveVersion = "1.0.0"
/** 現行アーカイブバージョン */
export const STUDENT_CURRENT_VERSION: StudentArchiveVersion = "1.0.0"
/** サポート対象バージョン（昇順） */
export const STUDENT_SUPPORTED_VERSIONS: readonly StudentArchiveVersion[] = [
  "1.0.0",
] as const

// =============================================================================
// Archive Manifest
// =============================================================================

/**
 * 生徒アーカイブのメタ情報
 */
export interface StudentArchiveManifest {
  /** アーカイブ種別（試験アーカイブと区別するため） */
  archiveType: "students"
  /** アーカイブ形式バージョン */
  version: string
  /** アプリケーションバージョン */
  appVersion: string
  /** エクスポート日時 (ISO8601) */
  exportedAt: string
  /** データ件数サマリー */
  counts: StudentArchiveDataCounts
}

/**
 * 生徒アーカイブ内のデータ件数
 */
export interface StudentArchiveDataCounts {
  students: number
  classrooms: number
  memberships: number
}

// =============================================================================
// Export
// =============================================================================

/**
 * エクスポートオプション
 */
export interface ExportStudentsArchiveOptions {
  /** エクスポート対象の生徒ID */
  studentIds: string[]
  /** エクスポート対象の学級ID（省略時: 選択生徒に関連する全学級） */
  classroomIds?: string[]
}

/**
 * エクスポート結果
 */
export interface ExportStudentsArchiveResult {
  success: boolean
  outputPath?: string
  manifest?: StudentArchiveManifest
  error?: string
}

// =============================================================================
// Import - File Overview
// =============================================================================

/**
 * 生徒アーカイブのファイル概要データ（Step 2 表示用）
 */
export interface StudentArchiveFileOverviewData {
  /** 生徒の照合結果 */
  student: PreMatchingResult
  /** 学級の照合結果 */
  classroom: PreMatchingResult
}

// =============================================================================
// Import - ID Integration
// =============================================================================

/**
 * 生徒アーカイブのID統合設定
 */
export interface StudentArchiveIdIntegrationConfig {
  student: CategoryIdIntegrationConfig
  classroom: CategoryIdIntegrationConfig
}

// =============================================================================
// Import - Result
// =============================================================================

/**
 * インポート結果
 */
export interface StudentArchiveImportResult {
  success: boolean
  summary?: {
    created: StudentArchiveDataCounts
    updated: StudentArchiveDataCounts
    skipped: StudentArchiveDataCounts
    unchanged: StudentArchiveDataCounts
  }
  warnings?: string[]
  error?: string
}

// =============================================================================
// Import Wizard State
// =============================================================================

/**
 * ウィザードのステップ
 */
export type StudentImportWizardStep =
  | "file_select"
  | "file_overview"
  | "id_integration"
  | "update_confirm"
  | "final_confirm"
  | "execute"

/**
 * ウィザードの状態
 */
export interface StudentImportWizardState {
  currentStep: StudentImportWizardStep
  archivePath: string | null
  manifest: StudentArchiveManifest | null
  fileOverviewData: StudentArchiveFileOverviewData | null
  idIntegrationConfig: StudentArchiveIdIntegrationConfig
  isProcessing: boolean
  error: string | null
  updateDecisions: UpdateDecisions
}

/**
 * デフォルトのID統合設定
 */
const DEFAULT_STUDENT_ID_INTEGRATION_CONFIG: StudentArchiveIdIntegrationConfig =
  {
    student: { strategy: "by_student_number", decisions: [] },
    classroom: { strategy: "by_name", decisions: [] },
  }

/**
 * 初期ウィザード状態
 */
export const INITIAL_STUDENT_IMPORT_WIZARD_STATE: StudentImportWizardState = {
  currentStep: "file_select",
  archivePath: null,
  manifest: null,
  fileOverviewData: null,
  idIntegrationConfig: DEFAULT_STUDENT_ID_INTEGRATION_CONFIG,
  isProcessing: false,
  error: null,
  updateDecisions: {},
}
