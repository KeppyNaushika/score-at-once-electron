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
    preMatch: (options: { archivePath: string }) => Promise<FileOverviewData>

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
      examId: string
      summary: {
        created: ArchiveDataCounts
        updated: ArchiveDataCounts
        skipped: ArchiveDataCounts
        unchanged: ArchiveDataCounts
      }
      warnings: string[]
    }>

    /**
     * 採点競合を検出
     */
    detectScoringConflicts: (options: {
      archivePath: string
      preMatchResult: FileOverviewData
      integrationConfig: IdIntegrationConfig
    }) => Promise<ScoringConflictData>

    /**
     * 複数試験を一括エクスポート
     */
    bulkExportExams: (
      options: BulkExportExamsOptions
    ) => Promise<BulkExportExamsResult>

    /**
     * インポートファイル選択ダイアログ
     */
    /** 選ばずに閉じた場合は canceled で返る（失敗ではない） */
    selectImportFile: () => Promise<
      | { canceled: true }
      | {
          canceled: false
          filePath: string
          /** ファイルの元形式 */
          sourceFormat: "score" | "hsz" | "dat"
        }
    >

    /**
     * .hszファイルを.score形式に変換
     */
    convertHszToScore: (options: {
      hszPath: string
    }) => Promise<{ scorePath: string; originalTitle: string }>

    /**
     * .datファイル（リアテンダント）を.score形式に変換
     */
    convertDatToScore: (options: {
      datPath: string
    }) => Promise<{ scorePath: string; originalTitle: string }>
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
    /** 選ばずに閉じた場合は canceled で返る（失敗ではない） */
    selectImportFile: () => Promise<
      { canceled: true } | { canceled: false; filePath: string }
    >

    /**
     * アーカイブ解析（マニフェスト読み取り）
     */
    analyzeArchive: (options: {
      archivePath: string
    }) => Promise<StudentArchiveManifest>

    /**
     * 事前照合を実行
     */
    preMatch: (options: {
      archivePath: string
    }) => Promise<StudentArchiveFileOverviewData>

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
