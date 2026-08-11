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

/**
 * アーカイブバージョン（追加時にユニオンへ足す）
 *
 * - 1.0.0: 初版（独立化）。資料1件を入れ子ツリーへ射影して持っていた
 * - 1.1.0: テーブルごとの平坦なセクションへ変更し、各行を Prisma の行のまま持つ。
 *   点数の参照が studentId → courseworkStudentId（#962 Phase B）
 */
export type CourseworkArchiveVersion = "1.0.0" | "1.1.0"
/** 現行アーカイブバージョン */
export const COURSEWORK_CURRENT_VERSION: CourseworkArchiveVersion = "1.1.0"
/** 読込可能な最小バージョン */
export const COURSEWORK_MIN_SUPPORTED_VERSION: CourseworkArchiveVersion =
  "1.0.0"
/** サポート対象バージョン（昇順） */
export const COURSEWORK_SUPPORTED_VERSIONS: readonly CourseworkArchiveVersion[] =
  ["1.0.0", "1.1.0"] as const

export interface CourseworkArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  counts: {
    courseworks: number
    items: number
    scores: number
    students: number
    classrooms: number
  }
}

// =============================================================================
// v1.1.0: テーブルごとの平坦なセクション（Prisma の行をそのまま持つ）
//
// Prisma の型のうち JSON にそのまま載らないものだけを、JSON.stringify と同じ規則で
// 文字列にする（DateTime → ISO 文字列、Decimal → decimal.js の toJSON と同じ文字列）。
// 射影・詰め替えはしない。列を足したらここにも足すこと。
// =============================================================================

/** Coursework の行 */
export interface ArchiveCourseworkRow {
  id: string
  name: string
  description: string | null
  date: string | null
  createdAt: string
  updatedAt: string
}

/** CourseworkClassroom（資料×学級）の行 */
export interface ArchiveCourseworkClassroomRow {
  id: string
  courseworkId: string
  classroomId: string
  order: number
  createdAt: string
  updatedAt: string
}

/** CourseworkTag（資料×タグ）の行 */
export interface ArchiveCourseworkTagRow {
  id: string
  courseworkId: string
  tagId: string
  createdAt: string
  updatedAt: string
}

/** CourseworkStudent（資料の対象者＝名簿）の行 */
export interface ArchiveCourseworkStudentRow {
  id: string
  courseworkId: string
  studentId: string
  customOrder: number | null
  createdAt: string
  updatedAt: string
}

/** CourseworkItem（評価項目）の行 */
export interface ArchiveCourseworkItemRow {
  id: string
  courseworkId: string
  name: string
  order: number
  /** Decimal */
  maxScore: string
  inputMode: string
  createdAt: string
  updatedAt: string
}

/** CourseworkLetterScale（文字評価→点数の変換表）の行 */
export interface ArchiveCourseworkLetterScaleRow {
  id: string
  courseworkItemId: string
  label: string
  /** Decimal */
  score: string
  order: number
  createdAt: string
  updatedAt: string
}

/** CourseworkScore（対象者×評価項目の点数）の行 */
export interface ArchiveCourseworkScoreRow {
  id: string
  courseworkItemId: string
  /**
   * 資料の対象者（CourseworkStudent.id）。取り込み先では名簿行の id が別物になるため、
   * import 時に「アーカイブの対象者 id → 取り込み先の対象者 id」へ解決する。
   * 名簿に対応行が無い点数（旧アーカイブに残りうる孤児）は破棄する。
   */
  courseworkStudentId: string
  /** Decimal */
  score: string | null
  letterValue: string | null
  /** Decimal */
  adjustment: string | null
  adjustmentReason: string | null
  comment: string | null
  createdAt: string
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
  classroomCode: string | null
  grade: number | null
  description: string | null
  isVisible: boolean
}

/** 学級所属（名簿復元・名前フォールバックの裏付け） */
export interface ArchiveCwMembership {
  id: string
  studentId: string
  classroomId: string
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

/**
 * 資料本体のセクション群（テーブルごとに平坦）。
 * grade-archive へ内包する際もこの形を流用する。
 */
export interface CourseworkSections {
  courseworks: ArchiveCourseworkRow[]
  courseworkClassrooms: ArchiveCourseworkClassroomRow[]
  courseworkTags: ArchiveCourseworkTagRow[]
  courseworkStudents: ArchiveCourseworkStudentRow[]
  courseworkItems: ArchiveCourseworkItemRow[]
  courseworkLetterScales: ArchiveCourseworkLetterScaleRow[]
  courseworkScores: ArchiveCourseworkScoreRow[]
}

/** 外部参照（生徒・学級・所属・タグ）の full レコード */
export interface CourseworkExternalSections {
  studentsData: ArchiveCwStudent[]
  classesData: ArchiveCwClass[]
  membershipsData: ArchiveCwMembership[]
  tagsData: ArchiveCwTag[]
}

/** アーカイブ全体（manifest + 各セクション） */
export interface CourseworkArchiveData
  extends CourseworkSections, CourseworkExternalSections {
  manifest: CourseworkArchiveManifest
}

/** dataCollector が返す収集結果（manifest を除いた本体 + counts） */
export interface CollectedCourseworkData
  extends CourseworkSections, CourseworkExternalSections {
  counts: CourseworkArchiveManifest["counts"]
}

/** インポート時に資料ごとにユーザーが選ぶ取り込み方法 */
export type CourseworkImportDecision =
  { action: "reuse"; existingId: string } | { action: "new" }

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

/** 保存ダイアログのキャンセルは失敗ではないので値で返す */
export type ExportCourseworkArchiveResult =
  | { canceled: true }
  | {
      canceled: false
      outputPath: string
      manifest: CourseworkArchiveManifest
    }

export interface CourseworkArchiveImportResult {
  createdCourseworkIds: string[]
  warnings: string[]
}

// バージョン変換の型（旧版の形・変換器・チェーン）は
// electron-src/lib/import/coursework-transformers/types.ts が持つ。
// このファイルは現行の形だけを宣言する。
