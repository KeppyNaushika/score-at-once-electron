/**
 * 試験外成績資料アーカイブ（.coursework）の型定義
 *
 * exam-archive と同型の「id 一次照合 + 名前マッチング（付加）」モデルを採用する。
 * 生徒・学級・タグは元 UUID 付きの full レコードを carry し、import 時に
 * UUID 一次 → 学籍番号/学級名/タグ名のフォールバックで既存実体へ統合、
 * いずれにも一致しなければ（allowCreate 時）新規作成する。
 *
 * grade-archive（.grade v1.5.0+）はこの収集・生成ロジックを再利用して内包する。
 * 旧 .grade（v1.4.0、名前ベース埋め込み）の読込互換は grade 側の legacy 経路で維持。
 */

/** アーカイブバージョン（追加時にユニオンへ足す） */
export type CourseworkArchiveVersion = "1.0.0"
/** 現行アーカイブバージョン */
export const COURSEWORK_CURRENT_VERSION: CourseworkArchiveVersion = "1.0.0"
/** 読込可能な最小バージョン */
export const COURSEWORK_MIN_SUPPORTED_VERSION: CourseworkArchiveVersion =
  "1.0.0"
/** サポート対象バージョン（昇順） */
export const COURSEWORK_SUPPORTED_VERSIONS: readonly CourseworkArchiveVersion[] =
  ["1.0.0"] as const

export interface CourseworkArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  counts: {
    courseworks: number
    items: number
    scores: number
    students: number
    classes: number
  }
}

/** 名簿・学級・タグ参照は UUID で持つ（名前は studentsData 等から逆引き可能） */
export interface ArchiveCourseworkRef {
  id: string
  name: string
  description: string | null
  date: string | null
  classes: { classId: string; order: number }[]
  tags: { tagId: string }[]
  students: { studentId: string; customOrder: number | null }[]
  items: ArchiveCourseworkItemRef[]
}

export interface ArchiveCourseworkItemRef {
  id: string
  name: string
  order: number
  maxScore: number
  inputMode: string
  letterScales: { label: string; score: number; order: number }[]
  scores: ArchiveCourseworkScoreRef[]
}

export interface ArchiveCourseworkScoreRef {
  studentId: string
  score: number | null
  letterValue: string | null
  adjustment: number | null
  adjustmentReason: string | null
  comment: string | null
  /** LWW 競合解決に使用 */
  updatedAt: string
}

/** full 生徒レコード（exam-archive ArchiveStudentsData["students"] と同形） */
export interface ArchiveCwStudent {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: number | null
  updatedAt: string
}

/** full 学級レコード */
export interface ArchiveCwClass {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  description: string | null
  isVisible: boolean
}

/** 学級所属（名簿復元・名前フォールバックの裏付け） */
export interface ArchiveCwMembership {
  id: string
  studentId: string
  classId: string
  startDate: string
  endDate: string | null
  attendanceNumber: number | null
  notes: string | null
}

export interface ArchiveCwTag {
  id: string
  name: string
  order: number
  color: string | null
}

/** アーカイブ全体（manifest + 各セクション）。grade-archive へ内包する際もこの形を流用する。 */
export interface CourseworkArchiveData {
  manifest: CourseworkArchiveManifest
  courseworks: ArchiveCourseworkRef[]
  studentsData: ArchiveCwStudent[]
  classesData: ArchiveCwClass[]
  membershipsData: ArchiveCwMembership[]
  tagsData: ArchiveCwTag[]
}

/** dataCollector が返す収集結果（manifest を除いた本体 + counts） */
export interface CollectedCourseworkData {
  courseworks: ArchiveCourseworkRef[]
  studentsData: ArchiveCwStudent[]
  classesData: ArchiveCwClass[]
  membershipsData: ArchiveCwMembership[]
  tagsData: ArchiveCwTag[]
  counts: CourseworkArchiveManifest["counts"]
}

/** インポート時に資料ごとにユーザーが選ぶ取り込み方法 */
export type CourseworkImportDecision =
  | { action: "reuse"; existingId: string }
  | { action: "new" }

/** アーカイブ内の資料 uuid → ユーザー決定 */
export type CourseworkImportDecisions = Record<string, CourseworkImportDecision>

/** 生徒・学級の二次照合方法（UUID 一致は常に優先される） */
export type CourseworkMatchingMethod = "studentNumber" | "name" | "none"

/** import 実行オプション */
export interface CourseworkImportOptions {
  /** 資料ごとの取り込み判断（archiveCourseworkId → 決定）。未指定は uuid 一致なら流用、無ければ新規 */
  courseworkDecisions?: CourseworkImportDecisions
  /** 生徒の二次照合方法（既定: studentNumber） */
  studentMatching?: CourseworkMatchingMethod
  /**
   * 未一致の生徒・学級を新規作成するか。
   * - true（既定・単体インポート）: 名前衝突時サフィックス付きで新規作成
   * - false（grade-archive 内包）: 既存 lookup のみ、未一致はスキップ + 警告
   */
  allowCreate?: boolean
}

/** 資料1件分のマッチング候補（ウィザードでユーザーに提示） */
export interface CourseworkArchiveMatch {
  archiveId: string
  name: string
  itemCount: number
  studentCount: number
  /** uuid 完全一致した既存資料（同一 PC 由来） */
  uuidMatch: { id: string; name: string } | null
  /** 名前一致した既存資料の候補（名前は非ユニークなので複数あり得る） */
  nameCandidates: { id: string; name: string }[]
}

/** インポートプレビュー（解析結果） */
export interface CourseworkArchiveImportPreview {
  manifest: CourseworkArchiveManifest
  matches: CourseworkArchiveMatch[]
  warnings: string[]
}

export interface ExportCourseworkArchiveOptions {
  courseworkId: string
  /** 未指定なら保存ダイアログを表示 */
  outputPath?: string
}

export interface ExportCourseworkArchiveResult {
  success: boolean
  outputPath?: string
  canceled?: boolean
  manifest?: CourseworkArchiveManifest
  error?: string
  warnings?: string[]
}

export interface CourseworkArchiveImportResult {
  success: boolean
  createdCourseworkIds?: string[]
  warnings?: string[]
  error?: string
}

// =============================================================================
// バージョントランスフォーマー
// =============================================================================

export interface CourseworkTransformResult {
  data: CourseworkArchiveData
  warnings: string[]
}

export interface CourseworkVersionTransformer {
  readonly fromVersion: CourseworkArchiveVersion
  readonly toVersion: CourseworkArchiveVersion
  transform(data: CourseworkArchiveData): CourseworkTransformResult
}

export interface CourseworkChainTransformResult {
  data: CourseworkArchiveData
  originalVersion: CourseworkArchiveVersion
  finalVersion: CourseworkArchiveVersion
  appliedTransformations: {
    from: CourseworkArchiveVersion
    to: CourseworkArchiveVersion
  }[]
  warnings: string[]
}
