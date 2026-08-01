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
  exportMode?: ArchiveExportMode
}

/**
 * アーカイブ内のデータ件数
 */
export interface ArchiveDataCounts {
  students: number
  classrooms: number
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
// Archive Version / Transformer Framework
// （coursework/grade/asb/student の *Archive.types.ts と同配置。
//   変換器実装は electron-src/lib/import/transformers/）
// =============================================================================

/**
 * サポートされているアーカイブバージョン
 *
 * - 1.0.0: v0.2.x (UserExam.invitedAt/invitedBy なし, PageImage使用)
 * - 1.1.0: v0.3.x (UserExam完全対応, ExamClassroom追加, PageImage使用)
 * - 1.2.0: v0.4.x (MasterImage/StudentAnswerImage分離, userId/studentId非NULL)
 * - 1.3.0: v0.5.x (Student.studentId → Student.studentNumber リネーム)
 * - 1.4.0: v0.5.x (ExamMarkingFormat, ExamExportSettings, CropRegionMarkingOverride, Subject, SubjectSubtotalGroup追加)
 * - 1.5.0: v0.6.x (Project→Exam, GradeProject→Grade リネーム、DBスキーマ変更)
 * - 1.6.0: v0.7.x (DrawingAnnotation.isFavorite 追加)
 * - 1.7.0: v0.8.x (CropRegionOmrConfig, CropRegionOmrChoiceOption 追加)
 * - 1.8.0: v0.9.x (MasterImage.pageSize 追加)
 * - 1.9.0: v0.9.x (DeletedRecord tombstone 追加)
 * - 1.10.0: v0.9.x (Subject→Tag リネーム, ExamTag 追加, Exam.subject 削除)
 * - 1.11.0: v0.10.x (OMRバブル位置永続化, CropRegionOmrDigitBox追加, CompoundAnswer追加, cellGeometryJson削除)
 * - 1.12.0: v0.12.x (Exam.markerCorrectionEnabled 追加 — ASB由来試験のマーク補正既定ONフラグ)
 * - 1.13.0: v0.12.x (ScoreDecision 追加 — OWNERによる確定スコア。QuestionScoreのstatus proposed/final廃止)
 * - 1.14.0: v0.13.x (ReturnSnapshot 追加 — 答案返却版スナップショット。返却後の採点修正差分検出用)
 * - 1.15.0: v0.14.x (ExamClassroom に teacherStat/studentReport、ExamSubtotalGroup に selectedForTable/selectedForBoxPlot 追加 — 学級統計再設計。statistics 廃止)
 * - 1.16.0: v0.14.x (物理テーブル名を Classroom 系へ統一、JSON キー examClasses→examClassrooms / classId→classroomId、ExamClassroom.teacherStat → teacherStatistics リネーム)
 * - 1.17.0: v0.15.x (ExamStudent.status を小文字へ統一)
 * - 1.18.0: v0.16.x (CropRegionMarkingOverride 廃止 — UI・出力反映が無いまま入出力のみ維持されていたため削除)
 * - 1.19.0: v0.16.x (DeletedRecord tombstone 廃止 — アーカイブは正本であり import は忠実に復元する。削除の伝搬は sqlite-nas-sync の `_tombstone` に一本化)
 * - 1.20.0: v0.16.x (CropRegionAssignment 追加 — 設問ごとの採点担当。ユーザーはアーカイブを越えないため username で照合する)
 * - 1.22.0: v0.17.x (ExamExportSettings のJSON埋め込みを5テーブルへ正規化。ExamMarkingFormat 廃止 — 採点マークは画像＋配置設定へ移行済み。
 *            CropRegionOmrDigitBox / numDigits / correctAnswer 廃止 — 手書き数字認識の撤去 #1103)
 * - 1.23.0: v0.17.x (MasterImage を ExamPage へ畳む — 模範解答画像は1ページ1枚しか作れず、
 *            読む側は全箇所が masterImages[0] を書いていた。examPages が imagePath / pageSize を直接持つ)
 * - 1.21.0: v0.16.x (採点層を ExamStudent 経由へ配線変更 — studentAnswerImages / questionScores / scoreDecisions / compoundAnswerScores / returnSnapshots の studentId を examStudentId へ。ReturnSnapshot.examId は ExamStudent が持つため削除)
 */
export type ExamArchiveVersion =
  | "1.0.0"
  | "1.1.0"
  | "1.2.0"
  | "1.3.0"
  | "1.4.0"
  | "1.5.0"
  | "1.6.0"
  | "1.7.0"
  | "1.8.0"
  | "1.9.0"
  | "1.10.0"
  | "1.11.0"
  | "1.12.0"
  | "1.13.0"
  | "1.14.0"
  | "1.15.0"
  | "1.16.0"
  | "1.17.0"
  | "1.18.0"
  | "1.19.0"
  | "1.20.0"
  | "1.21.0"
  | "1.22.0"
  | "1.23.0"

/** 現在の最新バージョン */
export const EXAM_CURRENT_VERSION: ExamArchiveVersion = "1.23.0"

/** サポートされている全バージョン（古い順） */
export const EXAM_SUPPORTED_VERSIONS: readonly ExamArchiveVersion[] = [
  "1.0.0",
  "1.1.0",
  "1.2.0",
  "1.3.0",
  "1.4.0",
  "1.5.0",
  "1.6.0",
  "1.7.0",
  "1.8.0",
  "1.9.0",
  "1.10.0",
  "1.11.0",
  "1.12.0",
  "1.13.0",
  "1.14.0",
  "1.15.0",
  "1.16.0",
  "1.17.0",
  "1.18.0",
  "1.19.0",
  "1.20.0",
  "1.21.0",
  "1.22.0",
  "1.23.0",
] as const

/**
 * 試験アーカイブ全体（変換対象の束ね）
 *
 * NOTE: `ArchiveExamData` は exam.json 単体（アーカイブ内の一セクション）、
 * `ExamArchiveData` はアーカイブ全 JSON の束ね。命名体系が異なる別物。
 */
export interface ExamArchiveData {
  manifest: ArchiveManifest
  examData: ArchiveExamData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  /** v1.4.0-v1.9.0 教科データ (deprecated, v1.10.0でtagsDataに移行) */
  subjectsData?: ArchiveSubjectsData
  /** v1.10.0+ タグデータ (v1.10.0でSubject→Tagにリネーム) */
  tagsData?: ArchiveTagsData
  /** v1.9.0-v1.18.0 削除記録データ (deprecated, v1.19.0で廃止。読み捨てのため変換器のみが参照する) */
  deletedRecordsData?: ArchiveDeletedRecordsData
}

/**
 * 変換結果
 */
export interface ExamTransformResult {
  /** 変換後のデータ */
  data: ExamArchiveData
  /** 変換時の警告メッセージ */
  warnings: string[]
}

/**
 * バージョン変換器インターフェース
 *
 * 各変換器は「特定のバージョンから次のバージョンへ」の変換を担当する
 */
export interface ExamVersionTransformer {
  /** 変換元バージョン */
  readonly fromVersion: ExamArchiveVersion
  /** 変換先バージョン */
  readonly toVersion: ExamArchiveVersion

  /**
   * アーカイブデータを次のバージョンに変換
   *
   * @param data - 変換元のアーカイブデータ
   * @returns 変換結果（データと警告）
   */
  transform(data: ExamArchiveData): ExamTransformResult
}

/**
 * 変換チェーンの実行結果
 */
export interface ExamChainTransformResult {
  /** 変換後のデータ */
  data: ExamArchiveData
  /** 元のバージョン（形状ベース補正後） */
  originalVersion: ExamArchiveVersion
  /** 最終バージョン */
  finalVersion: ExamArchiveVersion
  /** 適用された変換のリスト */
  appliedTransformations: {
    from: ExamArchiveVersion
    to: ExamArchiveVersion
  }[]
  /** 累積された警告メッセージ */
  warnings: string[]
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
export type ClassroomMatchingMethod = "name" | "none"
export type UserMatchingMethod = "username" | "none"
export type ExamMatchingMethod = "always_new"
export type SubtotalGroupMatchingMethod = "name" | "none"

/**
 * マッチング設定
 */
export interface MatchingConfig {
  student: StudentMatchingMethod
  classroom: ClassroomMatchingMethod
  user: UserMatchingMethod
  exam: ExamMatchingMethod
  subtotalGroup: SubtotalGroupMatchingMethod
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
  /** 全既存アイテム一覧（手動紐づけ用、小計グループで使用） */
  allExistingItems?: ExistingItemInfo[]
}

/**
 * 既存アイテムの概要情報（手動紐づけ用）
 */
export interface ExistingItemInfo {
  id: string
  name: string
  subtotals?: SubtotalInfo[]
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
  classroom: PreMatchingResult
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
  "by_student_number" | "by_name" | "individual" | "all_new"

export type ClassroomMatchingStrategy = "by_name" | "individual" | "all_new"

export type SubtotalGroupMatchingStrategy = "by_name" | "individual" | "all_new"

/**
 * ID選択（同一人物と判定した場合）
 *
 * UI表現:
 * - use_import_id: "書き出したPCに合わせる" → 既存データのIDを.scoreのIDに変更
 * - use_existing_id: "このPCに合わせる" → .scoreのIDを既存IDにマッピング
 */
export type IdChoice = "use_import_id" | "use_existing_id"

/** UIのSelect等が返す string を IdChoice へ絞り込む */
export function isIdChoice(value: string): value is IdChoice {
  return value === "use_import_id" || value === "use_existing_id"
}

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
    | ClassroomMatchingStrategy
    | SubtotalGroupMatchingStrategy
  /** 個別の決定（strategyがindividualの場合、またはstrategy適用後の個別調整） */
  decisions: IdIntegrationDecision[]
}

/**
 * 全カテゴリのID統合設定
 */
export interface IdIntegrationConfig {
  student: CategoryIdIntegrationConfig
  classroom: CategoryIdIntegrationConfig
  subtotalGroup: CategoryIdIntegrationConfig
  /** 小計項目の直接マッピング（importSubtotalId → existingSubtotalId | "__new__"） */
  subtotalMappings?: Record<string, string>
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
export type ArchiveExportMode = "full" | "template" | "template_with_subtotals"

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
  exportMode?: ArchiveExportMode
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
  exportMode?: ArchiveExportMode
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
    /** @deprecated v1.10.0で削除。ExamTagに移行 */
    subject?: string | null
    description: string | null
    /** v1.12.0+ 答案アップロード時のマーク補正既定ON設定（古いアーカイブではundefined） */
    markerCorrectionEnabled?: boolean
    createdAt: string
    updatedAt: string
  }
  examPages: Array<{
    id: string
    examId: string
    pageNumber: number
    /** v1.23.0+ 模範解答画像のパス。それ以前は masterImages に分かれていた。
     * 旧バージョンで模範解答だけを削除されたページは null */
    imagePath: string | null
    /** v1.23.0+ 用紙サイズ。それ以前は masterImages[].pageSize */
    pageSize: string
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
    cellGeometryJson?: string | null // v1.10.0以前の互換用（現在未使用）
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
    /** v1.11.0+ バブル位置 */
    shape?: string | null
    normalizedCx?: number | null
    normalizedCy?: number | null
    normalizedWidth?: number | null
    normalizedHeight?: number | null
    createdAt: string
    updatedAt: string
  }>
  /** v1.11.0+ CompoundAnswer（複合回答グループ） */
  compoundAnswers?: Array<{
    id: string
    examPageId: string
    label: string
    answerFormat: string
    correctAnswer: string
    points: number
    orderIndex: number | null
    alternativeAnswers: string | null
    requireReduced: boolean
    createdAt: string
    updatedAt: string
  }>
  /** v1.11.0+ CompoundAnswerMember（複合回答メンバー） */
  compoundAnswerMembers?: Array<{
    id: string
    compoundAnswerId: string
    cropRegionId: string
    order: number
    roleLabel: string | null
    separator: string | null
    createdAt: string
    updatedAt: string
  }>
  /** v1.11.0+ CompoundAnswerScore（複合回答スコア） */
  compoundAnswerScores?: Array<{
    id: string
    compoundAnswerId: string
    /** v1.21.0+ 受験者ID（ExamStudent.id）。それ以前は studentId */
    examStudentId: string
    userId: string
    recognizedAnswer: string | null
    status: string
    partialScore: string | null
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
  /** @deprecated v1.2.0〜v1.22.0。v1.23.0 以降は examPages が画像を直接持つ */
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
    /** v1.21.0+ 受験者ID（ExamStudent.id）。それ以前は studentId */
    examStudentId: string
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
    /** v1.15.0+ 小計点テーブル選択 */
    selectedForTable?: boolean
    /** v1.15.0+ 箱ひげ図選択 */
    selectedForBoxPlot?: boolean
    createdAt: string
    updatedAt: string
  }>
  /** v1.1.0+ ExamClassroom関係 */
  examClassrooms: Array<{
    id: string
    examId: string
    classroomId: string
    administered: boolean
    /** 〜v1.14.0 の旧フラグ（v1.15.0 で teacherStat へ移行）。旧アーカイブ読込時のみ存在 */
    statistics?: boolean
    /** v1.15.0 の旧フラグ（v1.16.0 で teacherStatistics へリネーム）。旧アーカイブ読込時のみ存在 */
    teacherStat?: boolean
    /** v1.16.0+ 教員集計対象 */
    teacherStatistics?: boolean
    /** v1.15.0+ 生徒表示対象 */
    studentReport?: boolean
    order: number
    createdAt: string
    updatedAt: string
  }>
  /** v1.22.0+ 答案に重ねる要素のスタイル（v1.4.0-v1.21.0 は examExportSettings のJSON内） */
  answerOverlayStyles?: Array<{
    id: string
    examId: string
    overlayKind: string
    position: string
    anchor: string
    offsetX: number
    offsetY: number
    size: number
    color: string
    opacity: number
    createdAt: string
    updatedAt: string
  }>
  /** v1.22.0+ 採点状態ごとの可視性 */
  answerOverlayVisibilities?: Array<{
    id: string
    examId: string
    status: string
    showMark: boolean
    showScore: boolean
    createdAt: string
    updatedAt: string
  }>
  /** v1.22.0+ 個人成績表の設定 */
  individualReportSettings?: {
    id: string
    examId: string
    displayMode: string
    showScore: boolean
    showMarks: boolean
    hideUnassignedSubtotals: boolean
    showGroupSubtotals: boolean
    showCorrectRate: boolean
    showScoreRate: boolean
    showLearningAdvice: boolean
    adviceReviewRateMin: number | null
    adviceReviewRateMax: number | null
    adviceReviewQuestionCount: number | null
    showComment: boolean
    showSignature: boolean
    pageLayout: string
    pageOrientation: string
    tableGroupSelectionEnabled: boolean
    statisticsIncludesParticipating: boolean
    statisticsIncludesExpected: boolean
    statisticsIncludesAbsent: boolean
    createdAt: string
    updatedAt: string
  } | null
  /** v1.22.0+ 個人成績表の表形式の節 */
  individualReportTableSections?: Array<{
    id: string
    examId: string
    tableKind: string
    enabled: boolean
    columns: number
    fontSize: number
    createdAt: string
    updatedAt: string
  }>
  /** v1.22.0+ 統計を種別×母集団で出すか */
  individualReportStatisticVisibilities?: Array<{
    id: string
    examId: string
    statisticKind: string
    scope: string
    shown: boolean
    createdAt: string
    updatedAt: string
  }>
  /** v1.22.0+ 個人成績表のグラフ設定 */
  individualReportGraphSettings?: {
    id: string
    examId: string
    showBarChart: boolean
    showRadarChart: boolean
    showTotalScoreBoxPlot: boolean
    boxPlotGroupSelectionEnabled: boolean
    showBoxPlotMin: boolean
    showBoxPlotQ1: boolean
    showBoxPlotMedian: boolean
    showBoxPlotQ3: boolean
    showBoxPlotMax: boolean
    showAverageLine: boolean
    showStudentMarker: boolean
    boxPlotFontSize: number
    boxPlotItemHeight: number
    createdAt: string
    updatedAt: string
  } | null
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
  classrooms: Array<{
    id: string
    name: string
    classroomCode: string | null
    grade: number | null
    description: string | null
    isVisible: boolean
    createdAt: string
    updatedAt: string
  }>
  memberships: Array<{
    id: string
    studentId: string
    classroomId: string
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
    /** v1.21.0+ 受験者ID（ExamStudent.id）。それ以前は studentId */
    examStudentId: string
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
  /** v1.13.0+ OWNERによる確定スコア（生徒×設問ごとに高々1件）。旧バージョンのアーカイブには存在しない */
  scoreDecisions?: Array<{
    id: string
    cropRegionId: string
    /** v1.21.0+ 受験者ID（ExamStudent.id）。それ以前は studentId */
    examStudentId: string
    verdict: string
    score: string | null // Decimal as string
    comment: string | null
    decidedByUserId: string
    decidedAt: string
    sourceQuestionScoreId: string | null
    createdAt: string
    updatedAt: string
  }>
  /**
   * v1.20.0+ 設問ごとの採点担当。
   *
   * ユーザーはアーカイブを越えない（users.json は currentUser のみ、UserExam は空）ため
   * `userId` ではなく `username` を denormalize して持ち、import 時に移行先DBの
   * `User.username` で lookup する。解決できない担当は破棄して警告する（新規ユーザーは作らない）。
   * id は (cropRegionId, userId) から決定論的に再生成するので、ここでは持ち回らない。
   */
  cropRegionAssignments?: Array<{
    cropRegionId: string
    username: string
    createdAt: string
    updatedAt: string
  }>
  /** v1.14.0+ 答案返却版スナップショット（受験者ごとに1行）。旧バージョンのアーカイブには存在しない */
  returnSnapshots?: Array<{
    id: string
    /** v1.21.0+ 受験者ID（ExamStudent.id）。それ以前は examId + studentId */
    examStudentId: string
    scoresJson: string
    totalScore: string | null // Decimal as string
    capturedByUserId: string | null
    capturedAt: string
    createdAt: string
    updatedAt: string
  }>
}

/**
 * 削除記録データ (deleted-records.json) - v1.9.0-v1.18.0
 * @deprecated v1.19.0で廃止。アーカイブは正本であり削除記録による復活防止は行わない（issue #918）。
 *   旧アーカイブの読み捨てのため V1_18_0_to_V1_19_0_Transformer のみが参照する
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

/**
 * タグデータ (subjects.json) - v1.4.0-v1.9.0
 * @deprecated v1.10.0以降は ArchiveTagsData を使用
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
 * タグデータ (tags.json) - v1.10.0+
 * Subject→Tagリネーム後の新形式
 */
export interface ArchiveTagsData {
  tags: Array<{
    id: string
    name: string
    /** v1.11.0+ 表示順 */
    order?: number
    /** v1.11.0+ 表示色 */
    color?: string | null
    createdAt: string
    updatedAt: string
  }>
  tagSubtotalGroups: Array<{
    id: string
    tagId: string
    subtotalGroupId: string
    createdAt: string
    updatedAt: string
  }>
  examTags: Array<{
    id: string
    examId: string
    tagId: string
    createdAt: string
    updatedAt: string
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
  | "execute"
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
  /** 処理中フラグ */
  isProcessing: boolean
  /** エラーメッセージ */
  error: string | null
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
  "import_wins" | "existing_wins" | "newer_wins" | "manual"

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
