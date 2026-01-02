/**
 * プロジェクトインポート/エクスポート機能の型定義
 */

// =============================================================================
// Archive Manifest (manifest.json)
// =============================================================================

/**
 * アーカイブのメタ情報
 */
export interface ArchiveManifest {
  /** アーカイブ形式バージョン (セマンティックバージョニング) */
  version: string
  /** Prismaスキーマバージョン (マイグレーション名等) */
  schemaVersion: string
  /** アプリケーションバージョン */
  appVersion: string
  /** エクスポート日時 (ISO8601) */
  exportedAt: string
  /** 元DBの識別子 (任意) */
  sourceDbId?: string
  /** プロジェクトID */
  projectId: string
  /** プロジェクト名 */
  projectName: string
  /** エクスポートしたユーザー名 */
  exportedBy?: string
  /** データ件数サマリー */
  counts: ArchiveDataCounts
}

/**
 * アーカイブ内のデータ件数
 */
export interface ArchiveDataCounts {
  students: number
  classes: number
  users: number
  pages: number
  regions: number
  scores: number
  annotations: number
  subtotalGroups: number
  masterImages: number
  answerSheetImages: number
}

// =============================================================================
// Matching Configuration
// =============================================================================

/**
 * マッチング方法
 */
export type StudentMatchingMethod = "uuid" | "studentId" | "name"
export type ClassMatchingMethod = "uuid" | "name"
export type UserMatchingMethod = "uuid" | "username"
export type ProjectMatchingMethod = "uuid" | "always_new"
export type SubtotalGroupMatchingMethod = "uuid" | "name"

/**
 * マッチング設定
 */
export interface MatchingConfig {
  student: StudentMatchingMethod
  class: ClassMatchingMethod
  user: UserMatchingMethod
  project: ProjectMatchingMethod
  subtotalGroup: SubtotalGroupMatchingMethod
}

/**
 * デフォルトのマッチング設定
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  student: "studentId",
  class: "name",
  user: "username",
  project: "always_new",
  subtotalGroup: "name",
}

// =============================================================================
// Conflict Resolution
// =============================================================================

/**
 * 競合解決ポリシー
 */
export type ConflictPolicy =
  | "import_wins" // インポートデータで上書き
  | "existing_wins" // 既存データを維持
  | "timestamp" // updatedAtが新しい方を採用
  | "manual" // 手動で個別選択

/**
 * 競合カテゴリ
 */
export type ConflictCategory =
  | "Student"
  | "Class"
  | "User"
  | "Project"
  | "SubtotalGroup"
  | "QuestionScore"
  | "DrawingAnnotation"

/**
 * 競合アイテム
 */
export interface ConflictItem {
  /** 一意識別子 */
  id: string
  /** 競合カテゴリ */
  category: ConflictCategory
  /** インポートデータ */
  importData: Record<string, unknown>
  /** 既存データ */
  existingData: Record<string, unknown>
  /** 解決方法 */
  resolution?: "import" | "existing" | "skip"
  /** 表示用ラベル */
  displayLabel?: string
  /** 詳細情報 */
  details?: string
}

/**
 * カテゴリ別競合解決設定
 */
export interface CategoryConflictResolution {
  /** 競合解決ポリシー */
  policy: ConflictPolicy
  /** 手動解決時の個別設定 */
  manualResolutions?: Record<string, "import" | "existing">
}

/**
 * 全体の競合解決設定
 */
export type ConflictResolutions = {
  [K in ConflictCategory]?: CategoryConflictResolution
}

// =============================================================================
// Import Preview / Analysis
// =============================================================================

/**
 * マッチング結果サマリー
 */
export interface MatchingSummary {
  /** 一致した件数 */
  matched: number
  /** 新規作成される件数 */
  newItems: number
  /** 競合している件数 */
  conflicts: number
}

/**
 * カテゴリ別のマッチング結果
 */
export interface CategoryMatchingResult {
  category: ConflictCategory
  summary: MatchingSummary
  /** 競合アイテムリスト */
  conflictItems: ConflictItem[]
  /** IDマッピング (import ID -> existing/new ID) */
  idMapping: Record<string, string>
}

/**
 * 競合検出結果
 */
export interface ConflictDetectionResult {
  success: boolean
  /** カテゴリ別の結果 */
  results: CategoryMatchingResult[]
  /** 警告メッセージ */
  warnings?: string[]
  error?: string
}

// =============================================================================
// Import Modes
// =============================================================================

/**
 * インポートモード
 */
export type ImportMode = "new" | "merge"

/**
 * インポートオプション
 */
export interface ImportOptions {
  /** インポートモード */
  mode: ImportMode
  /** マッチング設定 (mergeモード時のみ) */
  matchingConfig?: MatchingConfig
  /** 競合解決設定 (mergeモード時のみ) */
  conflictResolutions?: ConflictResolutions
}

// =============================================================================
// IPC API Types
// =============================================================================

/**
 * エクスポートオプション
 */
export interface ExportProjectOptions {
  projectId: string
  /** ログインユーザーID（このユーザーのデータのみエクスポート） */
  userId: string
  outputPath?: string
}

/**
 * エクスポート結果
 */
export interface ExportProjectResult {
  success: boolean
  outputPath?: string
  manifest?: ArchiveManifest
  error?: string
}

/**
 * アーカイブ解析オプション
 */
export interface AnalyzeArchiveOptions {
  archivePath: string
}

/**
 * アーカイブ解析結果
 */
export interface AnalyzeArchiveResult {
  success: boolean
  manifest?: ArchiveManifest
  /** バージョン互換性情報 */
  compatibility?: {
    isCompatible: boolean
    requiresUpgrade: boolean
    warnings: string[]
  }
  error?: string
}

/**
 * 競合検出オプション
 */
export interface DetectConflictsOptions {
  archivePath: string
  matchingConfig: MatchingConfig
}

/**
 * 新規作成インポートオプション
 */
export interface ImportAsNewOptions {
  archivePath: string
  /** 現在ログインしているユーザーID（このユーザーのデータとしてインポート） */
  currentUserId: string
}

/**
 * 新規作成インポート結果
 */
export interface ImportAsNewResult {
  success: boolean
  projectId?: string
  /** インポートされた件数 */
  importedCounts?: ArchiveDataCounts
  /** 警告メッセージ */
  warnings?: string[]
  error?: string
}

/**
 * マージインポートオプション
 */
export interface MergeImportOptions {
  archivePath: string
  matchingConfig: MatchingConfig
  conflictResolutions: ConflictResolutions
}

/**
 * マージインポート結果
 */
export interface MergeImportResult {
  success: boolean
  projectId?: string
  /** インポートサマリー */
  summary?: {
    created: ArchiveDataCounts
    updated: ArchiveDataCounts
    skipped: ArchiveDataCounts
  }
  /** 警告メッセージ */
  warnings?: string[]
  error?: string
}

// =============================================================================
// Archive Data Structures (JSON files in archive)
// =============================================================================

/**
 * プロジェクトデータ (project.json)
 */
export interface ArchiveProjectData {
  project: {
    id: string
    examName: string
    examDate: string | null
    subject: string | null
    description: string | null
    createdAt: string
    updatedAt: string
  }
  projectPages: Array<{
    id: string
    projectId: string
    pageNumber: number
    createdAt: string
    updatedAt: string
  }>
  cropRegions: Array<{
    id: string
    projectPageId: string
    label: string
    type: string
    x: number
    y: number
    width: number
    height: number
    points: number | null
    orderIndex: number | null
    createdAt: string
    updatedAt: string
  }>
  pageImages: Array<{
    id: string
    projectPageId: string
    studentId: string | null
    imagePath: string
    imageType: string
    createdAt: string
    updatedAt: string
  }>
  projectStudents: Array<{
    id: string
    projectId: string
    studentId: string
    status: string
    customOrder: number | null
    createdAt: string
    updatedAt: string
  }>
  userProjects: Array<{
    id: string
    userId: string
    projectId: string
    role: string
    invitedAt: string
    invitedBy: string | null
    createdAt: string
    updatedAt: string
  }>
  projectSubtotalGroups: Array<{
    id: string
    projectId: string
    subtotalGroupId: string
    createdAt: string
    updatedAt: string
  }>
  /** v1.1.0+ ProjectClass関係 */
  projectClasses: Array<{
    id: string
    projectId: string
    classId: string
    administered: boolean
    statistics: boolean
    order: number
    createdAt: string
    updatedAt: string
  }>
}

/**
 * 生徒データ (students.json)
 */
export interface ArchiveStudentsData {
  students: Array<{
    id: string
    studentId: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    enrollmentYear: number | null
    createdAt: string
    updatedAt: string
  }>
}

/**
 * 学級データ (classes.json)
 */
export interface ArchiveClassesData {
  classes: Array<{
    id: string
    name: string
    classCode: string | null
    grade: number | null
    description: string | null
    isVisible: boolean
    createdAt: string
    updatedAt: string
  }>
  memberships: Array<{
    id: string
    studentId: string
    classId: string
    startDate: string
    endDate: string | null
    attendanceNumber: number | null
    notes: string | null
    createdAt: string
    updatedAt: string
  }>
}

/**
 * ユーザーデータ (users.json)
 */
export interface ArchiveUsersData {
  users: Array<{
    id: string
    username: string
    name: string
    role: string
    createdAt: string
    updatedAt: string
    // パスワード/パスコードは含めない
  }>
}

/**
 * 小計データ (subtotals.json)
 */
export interface ArchiveSubtotalsData {
  subtotalGroups: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }>
  subtotals: Array<{
    id: string
    name: string
    subtotalGroupId: string
    order: number
    createdAt: string
    updatedAt: string
  }>
  cropSubtotals: Array<{
    id: string
    cropRegionId: string
    subtotalId: string
    assignmentType: string
    createdAt: string
    updatedAt: string
  }>
}

/**
 * 採点データ (scores.json)
 */
export interface ArchiveScoresData {
  questionScores: Array<{
    id: string
    cropRegionId: string
    studentId: string | null
    partialScore: string | null // Decimal as string
    status: string
    scoredByUserId: string | null
    createdAt: string
    updatedAt: string
  }>
  drawingAnnotations: Array<{
    id: string
    questionScoreId: string
    type: string
    x: number
    y: number
    color: string
    strokeWidth: number
    width: number
    height: number
    endX: number
    endY: number
    lineStyle: string
    text: string
    fontSize: number
    textBoxWidth: number
    textBoxHeight: number
    horizontalAlign: string
    verticalAlign: string
    anchorDirection: string
    displayX: number
    displayY: number
    createdByUserId: string | null
    createdAt: string
    updatedAt: string
  }>
}

// =============================================================================
// Import Wizard State
// =============================================================================

/**
 * ウィザードのステップ
 */
export type ImportWizardStep =
  | "file_select" // Step 1: ファイル選択
  | "mode_select" // Step 2: モード選択
  | "matching_config" // Step 3: マッチング設定
  | "conflict_resolve" // Step 4: 競合解決
  | "execute" // Step 5: 実行

/**
 * ウィザードの状態
 */
export interface ImportWizardState {
  /** 現在のステップ */
  currentStep: ImportWizardStep
  /** 選択されたアーカイブファイルパス */
  archivePath: string | null
  /** 解析されたマニフェスト */
  manifest: ArchiveManifest | null
  /** インポートモード */
  mode: ImportMode | null
  /** マッチング設定 */
  matchingConfig: MatchingConfig
  /** 競合検出結果 */
  conflictDetectionResult: ConflictDetectionResult | null
  /** 競合解決設定 */
  conflictResolutions: ConflictResolutions
  /** 処理中フラグ */
  isProcessing: boolean
  /** エラーメッセージ */
  error: string | null
}

/**
 * 初期ウィザード状態
 */
export const INITIAL_WIZARD_STATE: ImportWizardState = {
  currentStep: "file_select",
  archivePath: null,
  manifest: null,
  mode: null,
  matchingConfig: DEFAULT_MATCHING_CONFIG,
  conflictDetectionResult: null,
  conflictResolutions: {},
  isProcessing: false,
  error: null,
}
