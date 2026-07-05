/**
 * 試験アーカイブ・生徒アーカイブ（エクスポート/インポート）関連API
 */
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
      exportMode?: import("../examArchive.types").ArchiveExportMode
    }) => Promise<import("../examArchive.types").ExportExamResult>

    /**
     * アーカイブファイルを解析してプレビュー情報を取得
     */
    analyzeArchive: (
      options: import("../examArchive.types").AnalyzeArchiveOptions
    ) => Promise<import("../examArchive.types").AnalyzeArchiveResult>

    /**
     * 事前照合を実行（Step 2: ファイル概要表示用）
     */
    preMatch: (options: { archivePath: string }) => Promise<{
      success: boolean
      data?: import("../examArchive.types").FileOverviewData
      error?: string
    }>

    /**
     * 競合を検出（マージインポート用ドライラン）
     */
    detectConflicts: (
      options: import("../examArchive.types").DetectConflictsOptions
    ) => Promise<import("../examArchive.types").ConflictDetectionResult>

    /**
     * ID統合インポートを実行（新しいフロー）
     */
    idIntegrationImport: (options: {
      archivePath: string
      preMatchResult: import("../examArchive.types").FileOverviewData
      integrationConfig: import("../examArchive.types").IdIntegrationConfig
      currentUserId: string
      scoringConflictConfig?: import("../examArchive.types").ScoringConflictConfig
      updateDecisions?: import("../examArchive.types").UpdateDecisions
    }) => Promise<{
      success: boolean
      examId?: string
      summary?: {
        created: import("../examArchive.types").ArchiveDataCounts
        updated: import("../examArchive.types").ArchiveDataCounts
        skipped: import("../examArchive.types").ArchiveDataCounts
        unchanged: import("../examArchive.types").ArchiveDataCounts
      }
      warnings?: string[]
      error?: string
    }>

    /**
     * 採点競合を検出
     */
    detectScoringConflicts: (options: {
      archivePath: string
      preMatchResult: import("../examArchive.types").FileOverviewData
      integrationConfig: import("../examArchive.types").IdIntegrationConfig
    }) => Promise<{
      success: boolean
      data?: import("../examArchive.types").ScoringConflictData
      error?: string
    }>

    /**
     * 複数試験を一括エクスポート
     */
    bulkExportExams: (
      options: import("../examArchive.types").BulkExportExamsOptions
    ) => Promise<import("../examArchive.types").BulkExportExamsResult>

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
      options: import("../studentArchive.types").ExportStudentsArchiveOptions
    ) => Promise<import("../studentArchive.types").ExportStudentsArchiveResult>

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
      manifest?: import("../studentArchive.types").StudentArchiveManifest
      error?: string
    }>

    /**
     * 事前照合を実行
     */
    preMatch: (options: { archivePath: string }) => Promise<{
      success: boolean
      data?: import("../studentArchive.types").StudentArchiveFileOverviewData
      error?: string
    }>

    /**
     * インポートを実行
     */
    import: (options: {
      archivePath: string
      preMatchResult: import("../studentArchive.types").StudentArchiveFileOverviewData
      integrationConfig: import("../studentArchive.types").StudentArchiveIdIntegrationConfig
      updateDecisions?: import("../examArchive.types").UpdateDecisions
    }) => Promise<import("../studentArchive.types").StudentArchiveImportResult>
  }
}
