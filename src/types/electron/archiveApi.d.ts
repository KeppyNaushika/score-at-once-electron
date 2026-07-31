/**
 * 試験アーカイブ・生徒アーカイブ（エクスポート/インポート）関連API
 */

import type {
  AnalyzeArchiveOptions,
  AnalyzeArchiveResult,
  ArchiveDataCounts,
  ArchiveExportMode,
  BulkExportExamsOptions,
  BulkExportExamsResult,
  ExportExamResult,
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflictConfig,
  ScoringConflictData,
  UpdateDecisions,
} from "../examArchive.types"
import type {
  ExportStudentsArchiveOptions,
  ExportStudentsArchiveResult,
  StudentArchiveFileOverviewData,
  StudentArchiveIdIntegrationConfig,
  StudentArchiveImportResult,
  StudentArchiveManifest,
} from "../studentArchive.types"

export interface ArchiveAPI {
  // =============================================================================
  // 試験アーカイブ（エクスポート/インポート）関連
  // =============================================================================
  archive: {
    /**
     * 試験をZIPアーカイブとしてエクスポート
     */
    exportExam: (options: {
      examId: string
      userId: string
      outputPath?: string
      exportMode?: ArchiveExportMode
    }) => Promise<ExportExamResult>

    /**
     * アーカイブファイルを解析してプレビュー情報を取得
     */
    analyzeArchive: (
      options: AnalyzeArchiveOptions
    ) => Promise<AnalyzeArchiveResult>

    /**
     * 事前照合を実行（Step 2: ファイル概要表示用）
     */
    preMatch: (options: { archivePath: string }) => Promise<{
      success: boolean
      data?: FileOverviewData
      error?: string
    }>

    /**
     * ID統合インポートを実行（新しいフロー）
     */
    idIntegrationImport: (options: {
      archivePath: string
      preMatchResult: FileOverviewData
      integrationConfig: IdIntegrationConfig
      currentUserId: string
      scoringConflictConfig?: ScoringConflictConfig
      updateDecisions?: UpdateDecisions
    }) => Promise<{
      success: boolean
      examId?: string
      summary?: {
        created: ArchiveDataCounts
        updated: ArchiveDataCounts
        skipped: ArchiveDataCounts
        unchanged: ArchiveDataCounts
      }
      warnings?: string[]
      error?: string
    }>

    /**
     * 採点競合を検出
     */
    detectScoringConflicts: (options: {
      archivePath: string
      preMatchResult: FileOverviewData
      integrationConfig: IdIntegrationConfig
    }) => Promise<{
      success: boolean
      data?: ScoringConflictData
      error?: string
    }>

    /**
     * 複数試験を一括エクスポート
     */
    bulkExportExams: (
      options: BulkExportExamsOptions
    ) => Promise<BulkExportExamsResult>

    /**
     * インポートファイル選択ダイアログ
     */
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      /** ファイルの元形式 */
      sourceFormat?: "score" | "hsz" | "dat"
      error?: string
    }>

    /**
     * .hszファイルを.score形式に変換
     */
    convertHszToScore: (options: { hszPath: string }) => Promise<{
      success: boolean
      scorePath?: string
      originalTitle?: string
      error?: string
    }>

    /**
     * .datファイル（リアテンダント）を.score形式に変換
     */
    convertDatToScore: (options: { datPath: string }) => Promise<{
      success: boolean
      scorePath?: string
      originalTitle?: string
      error?: string
    }>
  }

  // =============================================================================
  // 生徒アーカイブ（エクスポート/インポート）関連
  // =============================================================================
  studentArchive: {
    /**
     * 選択した生徒・学級データを.studentsファイルとしてエクスポート
     */
    exportStudents: (
      options: ExportStudentsArchiveOptions
    ) => Promise<ExportStudentsArchiveResult>

    /**
     * .studentsファイル選択ダイアログ
     */
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>

    /**
     * アーカイブ解析（マニフェスト読み取り）
     */
    analyzeArchive: (options: { archivePath: string }) => Promise<{
      success: boolean
      manifest?: StudentArchiveManifest
      error?: string
    }>

    /**
     * 事前照合を実行
     */
    preMatch: (options: { archivePath: string }) => Promise<{
      success: boolean
      data?: StudentArchiveFileOverviewData
      error?: string
    }>

    /**
     * インポートを実行
     */
    import: (options: {
      archivePath: string
      preMatchResult: StudentArchiveFileOverviewData
      integrationConfig: StudentArchiveIdIntegrationConfig
      updateDecisions?: UpdateDecisions
    }) => Promise<StudentArchiveImportResult>
  }
}
