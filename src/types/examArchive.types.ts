/**
 * 試験インポート/エクスポート機能の型定義
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
  /** 試験ID */
  examId: string
  /** 試験名 */
  examName: string
  /** エクスポートしたユーザー名 */
  exportedBy?: string
  /** データ件数サマリー */
  counts: ArchiveDataCounts
  /** エクスポートモード（部分エクスポート時に記録） */
  exportMode?: ExportMode
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
 *
 * 照合の流れ:
 * 1. まずUUIDで自動照合（同じPCでエクスポート/インポートした場合）
 * 2. UUIDが一致しない場合、以下の二次照合方法で照合
 *    - "none": 二次照合しない（全て新規登録）
 *    - その他: 指定されたフィールドで照合
 */
export type StudentMatchingMethod = "studentNumber" | "name" | "none"
export type ClassMatchingMethod = "name" | "none"
export type UserMatchingMethod = "username" | "none"
export type ExamMatchingMethod = "always_new"
export type SubtotalGroupMatchingMethod = "name" | "none"

/**
 * マッチング設定
 */
export interface MatchingConfig {
  student: StudentMatchingMethod
  class: ClassMatchingMethod
  user: UserMatchingMethod
  exam: ExamMatchingMethod
  subtotalGroup: SubtotalGroupMatchingMethod
}

/**
 * デフォルトのマッチング設定
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  student: "studentNumber",
  class: "name",
  user: "username",
  exam: "always_new",
  subtotalGroup: "name",
}

// =============================================================================
// Step 2: ファイル概要説明 用の型
// =============================================================================

/**
 * 事前照合の結果（カテゴリ別）
 * Step 2 で「自動で紐づく」「判断が必要」の件数を表示するために使用
 */
export interface PreMatchingResult {
  /** ID一致（同じパソコンで作ったデータ） */
  byId: MatchedItem[]
  /** 学籍番号一致（生徒のみ） */
  byStudentNumber?: MatchedItem[]
  /** 氏名/名前一致 */
  byName?: MatchedItem[]
  /** どれにも一致しない */
  noMatch: ImportItem[]
}

/**
 * 小計項目の概要情報（プレビュー・マッピング用）
 */
export interface SubtotalInfo {
  id: string
  name: string
  order: number
}

/**
 * 照合でマッチしたアイテム
 */
export interface MatchedItem {
  /** インポートデータのID */
  importId: string
  /** 既存データのID */
  existingId: string
  /** インポートデータ */
  importData: Record<string, unknown>
  /** 既存データ */
  existingData: Record<string, unknown>
  /** 表示用ラベル（例: "山田太郎（001）"） */
  displayLabel: string
  /** 一致理由（例: "学籍番号が一致"） */
  matchReason: string
  /** 追加情報（小計グループの場合、配下の小計項目一覧） */
  additionalInfo?: {
    importSubtotals?: SubtotalInfo[]
    existingSubtotals?: SubtotalInfo[]
  }
}

/**
 * インポートデータ（マッチしなかったもの含む）
 */
export interface ImportItem {
  /** インポートデータのID */
  importId: string
  /** インポートデータ */
  importData: Record<string, unknown>
  /** 表示用ラベル */
  displayLabel: string
  /** 追加情報（小計グループの場合、配下の小計項目一覧） */
  additionalInfo?: {
    importSubtotals?: SubtotalInfo[]
  }
}

/**
 * 試験の事前照合結果
 */
export interface ExamPreMatchingResult {
  /** ID一致（同じパソコンで作った試験） */
  isIdMatch: boolean
  /** インポートデータの試験ID */
  importExamId: string
  /** 既存試験ID（ID一致の場合） */
  existingExamId?: string
  /** インポートデータ */
  importData: Record<string, unknown>
  /** 既存データ（ID一致の場合） */
  existingData?: Record<string, unknown>
  /** 表示用ラベル（試験名） */
  displayLabel: string
}

/**
 * ファイル概要データ（Step 2 表示用）
 */
export interface FileOverviewData {
  /** 生徒の照合結果 */
  student: PreMatchingResult
  /** 学級の照合結果 */
  class: PreMatchingResult
  /** 小計グループの照合結果 */
  subtotalGroup: PreMatchingResult
  /** 試験の照合結果（ID一致 = 同じPCでマージ可能） */
  exam?: ExamPreMatchingResult
  /** 採点結果の競合（Step 3.5 表示用、試験ID一致時のみ） */
  scoringConflicts?: ScoringConflictData
}

// =============================================================================
// Step 3: データの統合（ID選択）用の型
// =============================================================================

/**
 * 紐づけ方法の選択（Step 3 の最初の選択）
 *
 * UI表現:
 * - by_student_number: "学籍番号で紐づける (n件)"
 * - by_name: "氏名で紐づける (n件)"
 * - individual: "1人ずつ設定する"
 * - all_new: "全員を新しい生徒として追加する"
 */
export type StudentMatchingStrategy =
  | "by_student_number"
  | "by_name"
  | "individual"
  | "all_new"

export type ClassMatchingStrategy = "by_name" | "individual" | "all_new"

export type SubtotalGroupMatchingStrategy = "by_name" | "individual" | "all_new"

/**
 * ID選択（同一人物と判定した場合）
 *
 * UI表現:
 * - use_import_id: "書き出したPCに合わせる" → 既存データのIDを.scoreのIDに変更
 * - use_existing_id: "このPCに合わせる" → .scoreのIDを既存IDにマッピング
 */
export type IdChoice = "use_import_id" | "use_existing_id"

/**
 * 個別のID統合決定
 *
 * 3つのケース:
 * 1. same_person + idChoice: 同一人物としてIDを選択
 * 2. create_new: 新しい生徒/学級として登録
 * 3. skip: インポートしない
 */
export interface IdIntegrationDecision {
  /** インポートデータのID */
  importId: string
  /** 決定タイプ */
  decisionType: "same_person" | "create_new" | "skip"
  /** 同一人物の場合の既存データID */
  existingId?: string
  /** 同一人物の場合のID選択 */
  idChoice?: IdChoice
}

/**
 * カテゴリ別のID統合設定
 */
export interface CategoryIdIntegrationConfig {
  /** 紐づけ方法 */
  strategy:
    | StudentMatchingStrategy
    | ClassMatchingStrategy
    | SubtotalGroupMatchingStrategy
  /** 個別の決定（strategyがindividualの場合、またはstrategy適用後の個別調整） */
  decisions: IdIntegrationDecision[]
}

/**
 * 全カテゴリのID統合設定
 */
export interface IdIntegrationConfig {
  student: CategoryIdIntegrationConfig
  class: CategoryIdIntegrationConfig
  subtotalGroup: CategoryIdIntegrationConfig
  /** 小計項目の直接マッピング（importSubtotalId → existingSubtotalId | "__new__"） */
  subtotalMappings?: Record<string, string>
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
  | "Exam"
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

// =============================================================================
// Enhanced UI Types (先生向けUI用の拡張型)
// =============================================================================

/**
 * 変更されるフィールドの情報
 * UI表示例: 「氏名カナ: ヤマダ → ヤマダタロウ」
 */
export interface FieldChange {
  /** 内部フィールド名（例: "firstNameKana"） */
  field: string
  /** UI表示用ラベル（例: "氏名カナ"） */
  fieldLabel: string
  /** 現在の値 */
  currentValue: unknown
  /** インポート後の値 */
  newValue: unknown
}

/**
 * 確認が必要な生徒/学級の詳細情報
 * Step4「生徒・学級の確認」で使用
 */
export interface MatchingCandidate extends ConflictItem {
  /** 変更されるフィールド一覧 */
  fieldChanges: FieldChange[]
  /** インポートデータの方が新しいか */
  isImportNewer: boolean
  /** インポートデータの最終更新日 */
  importUpdatedAt: string
  /** 既存データの最終更新日 */
  existingUpdatedAt: string
  /** 一致と判断した理由（例: "学籍番号と氏名が一致"） */
  matchReason: string
}

/**
 * ユーザーの照合判断結果
 * 「同じ人」「別の人」「スキップ」
 */
export type MatchingDecisionType = "same_person" | "different_person" | "skip"

export interface MatchingDecision {
  /** アイテムID */
  itemId: string
  /** 判断結果 */
  decision: MatchingDecisionType
}

/**
 * 更新するかどうかの選択結果
 */
export interface UpdateDecision {
  /** アイテムID */
  itemId: string
  /** 情報を更新するか */
  shouldUpdate: boolean
}

/**
 * カテゴリ別の照合サマリー（先生向け表示用）
 */
export interface CategoryMatchingSummary {
  /** カテゴリ */
  category: ConflictCategory
  /** 自動で紐づく件数 */
  autoMatched: number
  /** 新しく登録される件数 */
  newItems: number
  /** 確認が必要な件数 */
  needsConfirmation: number
  /** 学籍番号重複などの問題がある件数 */
  hasConflict: number
  /** 自動で紐づくアイテムのリスト */
  autoMatchedItems: Array<{ id: string; displayLabel: string }>
  /** 新規登録されるアイテムのリスト */
  newItemsList: Array<{ id: string; displayLabel: string }>
  /** 確認が必要なアイテムのリスト */
  confirmationItems: MatchingCandidate[]
  /** 問題があるアイテムのリスト */
  conflictItems: MatchingCandidate[]
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
// Export Mode
// =============================================================================

/**
 * エクスポートモード
 *
 * - full: 全データ（現行動作）
 * - template: 模範解答＋領域情報のみ（採点テンプレート）
 * - template_with_subtotals: テンプレート＋小計設定
 */
export type ExportMode = "full" | "template" | "template_with_subtotals"

// =============================================================================
// IPC API Types
// =============================================================================

/**
 * 一括エクスポートオプション
 */
export interface BulkExportExamsOptions {
  examIds: string[]
  userId: string
  /** エクスポートモード（デフォルト: full） */
  exportMode?: ExportMode
}

/**
 * 一括エクスポートの個別試験結果
 */
export interface BulkExportExamResult {
  examId: string
  examName: string
  success: boolean
  outputPath?: string
  error?: string
}

/**
 * 一括エクスポート全体の結果
 */
export interface BulkExportExamsResult {
  success: boolean
  results: BulkExportExamResult[]
  outputDirectory?: string
  error?: string
}

/**
 * エクスポートオプション
 */
export interface ExportExamOptions {
  examId: string
  /** ログインユーザーID（このユーザーのデータのみエクスポート） */
  userId: string
  outputPath?: string
  /** エクスポートモード（デフォルト: full） */
  exportMode?: ExportMode
}

/**
 * エクスポート結果
 */
export interface ExportExamResult {
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

// =============================================================================
// Archive Data Structures (JSON files in archive)
// =============================================================================

/**
 * 試験データ (exam.json)
 */
export interface ArchiveExamData {
  exam: {
    id: string
    examName: string
    examDate: string | null
    subject: string | null
    description: string | null
    createdAt: string
    updatedAt: string
  }
  examPages: Array<{
    id: string
    examId: string
    pageNumber: number
    createdAt: string
    updatedAt: string
  }>
  cropRegions: Array<{
    id: string
    examPageId: string
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
  /** v1.7.0+ CropRegionOmrConfig */
  omrConfigs?: Array<{
    id: string
    cropRegionId: string
    type: string
    numChoices: number | null
    choiceLayout: string | null
    numDigits: number | null
    correctAnswer: string | null
    cellGeometryJson: string | null
    colorThreshold: number | null
    areaThreshold: number | null
    createdAt: string
    updatedAt: string
  }>
  /** v1.7.0+ CropRegionOmrChoiceOption */
  omrChoiceOptions?: Array<{
    id: string
    omrConfigId: string
    choiceIndex: number
    label: string
    isCorrect: boolean
    createdAt: string
    updatedAt: string
  }>
  /** @deprecated v1.2.0以降はmasterImages/studentAnswerImagesを使用 */
  pageImages: Array<{
    id: string
    examPageId: string
    studentId: string | null
    imagePath: string
    imageType: string
    createdAt: string
    updatedAt: string
  }>
  /** v1.2.0+ 模範解答画像 */
  masterImages?: Array<{
    id: string
    examPageId: string
    imagePath: string
    /** v1.8.0+ 用紙サイズ */
    pageSize?: string
    createdAt: string
    updatedAt: string
  }>
  /** v1.2.0+ 答案画像 */
  studentAnswerImages?: Array<{
    id: string
    examPageId: string
    studentId: string
    imagePath: string
    createdAt: string
    updatedAt: string
  }>
  examStudents: Array<{
    id: string
    examId: string
    studentId: string
    status: string
    customOrder: number | null
    createdAt: string
    updatedAt: string
  }>
  userExams: Array<{
    id: string
    userId: string
    examId: string
    role: string
    invitedAt: string
    invitedBy: string | null
    createdAt: string
    updatedAt: string
  }>
  examSubtotalGroups: Array<{
    id: string
    examId: string
    subtotalGroupId: string
    createdAt: string
    updatedAt: string
  }>
  /** v1.1.0+ ExamClass関係 */
  examClasses: Array<{
    id: string
    examId: string
    classId: string
    administered: boolean
    statistics: boolean
    order: number
    createdAt: string
    updatedAt: string
  }>
  /** v1.4.0+ 採点マーク設定 */
  examMarkingFormats?: Array<{
    id: string
    examId: string
    markType: string
    symbol: string
    color: string
    fontSize: number | null
    strokeWidth: number | null
    createdAt: string
    updatedAt: string
  }>
  /** v1.4.0+ エクスポート設定 */
  examExportSettings?: {
    id: string
    examId: string
    settingsJson: string
    createdAt: string
    updatedAt: string
  } | null
  /** v1.4.0+ 設問別マークオーバーライド */
  cropRegionMarkingOverrides?: Array<{
    id: string
    cropRegionId: string
    markType: string
    symbol: string | null
    color: string | null
    visible: boolean
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
    studentNumber: string
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
    studentId: string
    partialScore: string | null // Decimal as string
    status: string
    userId: string
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
    isFavorite: boolean
    userId: string
    createdAt: string
    updatedAt: string
  }>
}

/**
 * 教科データ (subjects.json) - v1.4.0+
 */
export interface ArchiveSubjectsData {
  subjects: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }>
  subjectSubtotalGroups: Array<{
    id: string
    subjectId: string
    subtotalGroupId: string
    createdAt: string
    updatedAt: string
  }>
}

/**
 * 削除記録データ (deleted-records.json) - v1.9.0+
 */
export interface ArchiveDeletedRecordsData {
  deletedRecords: Array<{
    id: string
    tableName: string
    recordId: string
    deletedAt: string
    userId: string | null
    examId: string | null
  }>
}

// =============================================================================
// Import Wizard State
// =============================================================================

/**
 * ウィザードのステップ（先生向けの表現）
 *
 * フロー: file_select → file_overview → id_integration → update_confirm → final_confirm → execute
 *
 * Step 2 (file_overview): ファイルの概要説明（ID一致数、判断必要数を表示）
 * Step 3 (id_integration): データの統合（レコードのIDをどうするか決める）
 * Step 4 (update_confirm): データの更新（ID以外のカラムをどうするか決める）
 */
export type ImportWizardStep =
  | "file_select" // Step 1: ファイル選択
  | "file_overview" // Step 2: ファイルの概要説明
  | "id_integration" // Step 3: データの統合（ID選択）
  | "update_confirm" // Step 4: 情報の更新確認（情報を上書きするか）
  | "final_confirm" // Step 5: 最終確認（サマリー表示）
  | "execute" // Step 6: 実行中/完了

/**
 * デフォルトのID統合設定
 */
export const DEFAULT_ID_INTEGRATION_CONFIG: IdIntegrationConfig = {
  student: { strategy: "by_student_number", decisions: [] },
  class: { strategy: "by_name", decisions: [] },
  subtotalGroup: { strategy: "by_name", decisions: [] },
}

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
  /** 事前照合結果（Step 2 表示用） */
  fileOverviewData: FileOverviewData | null
  /** ID統合設定（Step 3 で設定） */
  idIntegrationConfig: IdIntegrationConfig
  /** 採点結果の競合解決設定（Step 3.5 で設定） */
  scoringConflictConfig: ScoringConflictConfig
  /** マッチング設定（照合方法の選択）- 後方互換用 */
  matchingConfig: MatchingConfig
  /** 処理中フラグ */
  isProcessing: boolean
  /** エラーメッセージ */
  error: string | null
  /** カテゴリ別照合サマリー（先生向け表示用） */
  matchingSummaries: CategoryMatchingSummary[]
  /** ユーザーの照合判断（アイテムID -> 判断結果） */
  matchingDecisions: Record<string, MatchingDecisionType>
  /** ユーザーの更新判断（`${category}:${importId}` -> フィールドごとの戦略） */
  updateDecisions: UpdateDecisions
  /** 外部フォーマットの種別（.hsz/.dat選択時に設定） */
  sourceFormat?: "score" | "hsz" | "dat"
  /** .hsz免責事項モーダル表示フラグ */
  showHszDisclaimer?: boolean
  /** .hszの元ファイルパス（変換前） */
  hszOriginalPath?: string
  /** .hszの元タイトル */
  hszOriginalTitle?: string
}

/**
 * デフォルトの採点結果競合解決設定
 */
export const DEFAULT_SCORING_CONFLICT_CONFIG: ScoringConflictConfig = {
  strategy: "newer_wins",
  manualResolutions: {},
}

/**
 * 初期ウィザード状態
 */
export const INITIAL_WIZARD_STATE: ImportWizardState = {
  currentStep: "file_select",
  archivePath: null,
  manifest: null,
  fileOverviewData: null,
  idIntegrationConfig: DEFAULT_ID_INTEGRATION_CONFIG,
  scoringConflictConfig: DEFAULT_SCORING_CONFLICT_CONFIG,
  matchingConfig: DEFAULT_MATCHING_CONFIG,
  isProcessing: false,
  error: null,
  matchingSummaries: [],
  matchingDecisions: {},
  updateDecisions: {},
  sourceFormat: undefined,
  showHszDisclaimer: false,
  hszOriginalPath: undefined,
  hszOriginalTitle: undefined,
}

// =============================================================================
// Step 4: データ更新 用の型
// =============================================================================

/**
 * フィールド更新戦略
 * - keep_existing: このPCの値を維持
 * - use_import: ファイルの値で上書き
 * - use_newer: updatedAtを比較して新しい方を採用
 */
export type UpdateStrategy = "keep_existing" | "use_import" | "use_newer"

/**
 * フィールド単位の更新決定
 * key: フィールド名, value: 更新戦略
 */
export type FieldUpdateDecision = Record<string, UpdateStrategy>

/**
 * 全アイテムの更新決定
 * key: `${category}:${importId}`, value: フィールドごとの戦略
 */
export type UpdateDecisions = Record<string, FieldUpdateDecision>

// =============================================================================
// Step 3.5: 採点結果の競合解決 用の型
// =============================================================================

/**
 * 採点結果の競合解決方針
 *
 * UI表現（先生向け）:
 * - import_wins: "すべてファイルの採点を使う"
 * - existing_wins: "すべてこのPCの採点を使う"
 * - newer_wins: "新しい方（最終更新日時）を使う"
 * - manual: "競合している採点を1つずつ確認する"
 */
export type ScoringConflictResolutionStrategy =
  | "import_wins"
  | "existing_wins"
  | "newer_wins"
  | "manual"

/**
 * 採点結果の競合（1件分）
 */
export interface ScoringConflict {
  /** インポートデータのQuestionScore ID */
  importScoreId: string
  /** 既存データのQuestionScore ID */
  existingScoreId: string
  /** 生徒名（表示用） */
  studentName: string
  /** 生徒ID */
  studentId: string
  /** 設問ラベル（例: "問1"） */
  questionLabel: string
  /** CropRegion ID */
  cropRegionId: string
  /** インポートデータの採点結果 */
  importScore: {
    status: string
    partialScore: number | null
    updatedAt: string
  }
  /** 既存データの採点結果 */
  existingScore: {
    status: string
    partialScore: number | null
    updatedAt: string
  }
  /** 配点（表示用） */
  maxPoints: number | null
  /** 個別選択結果（manualの場合） */
  resolution?: "import" | "existing"
}

/**
 * 採点結果の競合検出結果
 */
export interface ScoringConflictData {
  /** 競合の件数（データが異なるもの） */
  conflictCount: number
  /** 競合しなかった件数（新規追加） */
  newCount: number
  /** 既存と同一の件数（変更なし） */
  unchangedCount: number
  /** 競合の詳細リスト */
  conflicts: ScoringConflict[]
}

/**
 * 採点結果の競合解決設定
 */
export interface ScoringConflictConfig {
  /** 解決方針 */
  strategy: ScoringConflictResolutionStrategy
  /** 個別選択結果（strategyがmanualの場合） */
  manualResolutions: Record<string, "import" | "existing">
}
