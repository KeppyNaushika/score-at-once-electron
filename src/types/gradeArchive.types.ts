/**
 * 成績算出アーカイブ(.grade)の型定義
 *
 * exam-archive / coursework-archive と同じく「Prisma のクエリが返した行をそのまま JSON に
 * 持つ」方針。射影・詰め替えはせず、JSON にそのまま載らない型だけを `JSON.stringify` と
 * 同じ規則で文字列にする（DateTime → ISO 文字列、Decimal → decimal.js の toJSON と同じ文字列）。
 * 列を足したらここにも足すこと。
 *
 * アーカイブに含まれない実体（生徒・学級・試験・小計・採点領域）への参照は、行が持つ uuid を
 * 一次キーとし、同定情報を別セクションで添える。生徒・学級は full レコードを carry するので
 * uuid → 学籍番号/学級名 のフォールバックが効く（coursework-archive と同じモデル）。
 * 試験・小計・採点領域はアーカイブに含められないため、名前・ラベルのヒントだけを添える。
 *
 * 旧バージョンの形は変換器側（grade-transformers）が持つ。ここは現行の形だけを宣言する。
 */

import type {
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  CollectedCourseworkData,
  CourseworkImportDecisions,
} from "./courseworkArchive.types"

export interface GradeArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  gradeId: string
  gradeName: string
  counts: {
    gradeItems: number
    dataSources: number
    manualScores: number
    boundaries: number
    classrooms: number
    students: number
  }
}

// =============================================================================
// 成績本体のセクション（テーブルごとに平坦。Prisma の行をそのまま持つ）
// =============================================================================

/** Grade の行 */
export interface ArchiveGradeRow {
  id: string
  name: string
  description: string | null
  referenceDate: string | null
  createdAt: string
  updatedAt: string
}

/** GradeClassroom（成績×学級）の行 */
export interface ArchiveGradeClassroomRow {
  id: string
  gradeId: string
  classroomId: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeStudent（成績の対象者＝名簿）の行 */
export interface ArchiveGradeStudentRow {
  id: string
  gradeId: string
  studentId: string
  customOrder: number | null
  createdAt: string
  updatedAt: string
}

/** GradeItem（評価項目）の行 */
export interface ArchiveGradeItemRow {
  id: string
  gradeId: string
  name: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeDataSource（成績データソース）の行 */
export interface ArchiveGradeDataSourceRow {
  id: string
  gradeItemId: string
  type: string
  /** 参照先はアーカイブ外。examRefs が同定情報を持つ */
  examId: string | null
  subtotalId: string | null
  cropRegionId: string | null
  /** 参照先は内包する courseworkArchive の行 */
  courseworkItemId: string | null
  courseworkId: string | null
  name: string
  /** Decimal */
  weight: string
  order: number
  absentMethod: string
  /** Decimal */
  absentRatio: string
  /** Decimal */
  absentOffset: string
  treatExpectedAsMissing: boolean
  estimationMode: string
  createdAt: string
  updatedAt: string
}

/** GradeDataSourceEstimationSource（欠損推定に使う他データソース）の行 */
export interface ArchiveGradeDataSourceEstimationSourceRow {
  id: string
  dataSourceId: string
  sourceDataSourceId: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeItemBoundary（評価項目の成績境界1本）の行 */
export interface ArchiveGradeItemBoundaryRow {
  id: string
  gradeItemId: string
  label: string
  /** Decimal */
  minPercentage: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeOverride（成績ラベルの手動上書き）の行 */
export interface ArchiveGradeOverrideRow {
  id: string
  gradeStudentId: string
  gradeItemId: string
  overrideLabel: string
  createdAt: string
  updatedAt: string
}

/**
 * GradeFrozenScore（成績値の確定）の行。
 *
 * `frozenByUserId` は行のまま持ち出すが、取り込み先に同じ User が居る保証は無い。
 * 解決できなければ null（操作者不明）にして取り込む。
 */
export interface ArchiveGradeFrozenScoreRow {
  id: string
  gradeStudentId: string
  gradeItemId: string
  /** Decimal */
  weightedScore: string | null
  /** Decimal */
  weightedMaxScore: string
  /** Decimal */
  percentage: string | null
  gradeLabel: string | null
  frozenByUserId: string | null
  frozenAt: string
  createdAt: string
  updatedAt: string
}

/** GradeItemExclusion（評価項目ごとの除外設定）の行 */
export interface ArchiveGradeItemExclusionRow {
  id: string
  gradeStudentId: string
  gradeItemId: string
  createdAt: string
  updatedAt: string
}

/** GradeConstraint（観点間の制約ルール）の行 */
export interface ArchiveGradeConstraintRow {
  id: string
  gradeId: string
  name: string
  kind: string
  targetGradeItemId: string | null
  aggregate: string
  /** Decimal */
  tolerance: string
  expression: string
  color: string
  message: string | null
  disabledReason: string | null
  enabled: boolean
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeConstraintViewpoint（制約の集計対象の観点）の行 */
export interface ArchiveGradeConstraintViewpointRow {
  id: string
  constraintId: string
  gradeItemId: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeConstraintLabelValue（ラベル→数値の対応）の行 */
export interface ArchiveGradeConstraintLabelValueRow {
  id: string
  constraintId: string
  label: string
  /** Decimal */
  value: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeConstraintExclusionLabel（混在禁止ラベル）の行 */
export interface ArchiveGradeConstraintExclusionLabelRow {
  id: string
  constraintId: string
  label: string
  order: number
  createdAt: string
  updatedAt: string
}

/** GradeIndividualReportSettings（個人成績通知書の設定）の行 */
export interface ArchiveGradeIndividualReportSettingsRow {
  id: string
  gradeId: string
  title: string
  showItemGrades: boolean
  itemGradeColumnScore: boolean
  itemGradeColumnPercentage: boolean
  itemGradeColumnGradeLabel: boolean
  itemGradeFontSize: number
  itemGradeTableColumns: number
  showSourceBreakdown: boolean
  sourceBreakdownColumnScore: boolean
  sourceBreakdownColumnWeight: boolean
  sourceBreakdownColumnComment: boolean
  sourceBreakdownFontSize: number
  sourceBreakdownTableColumns: number
  dataSourceLabel: string
  showCommentSection: boolean
  showSignatureSection: boolean
  footerLeft: string
  footerCenter: string
  footerRight: string
  createdAt: string
  updatedAt: string
}

/** 成績本体のセクション群（テーブルごとに平坦） */
export interface GradeSections {
  grades: ArchiveGradeRow[]
  gradeClassrooms: ArchiveGradeClassroomRow[]
  gradeStudents: ArchiveGradeStudentRow[]
  gradeItems: ArchiveGradeItemRow[]
  gradeDataSources: ArchiveGradeDataSourceRow[]
  gradeDataSourceEstimationSources: ArchiveGradeDataSourceEstimationSourceRow[]
  gradeItemBoundaries: ArchiveGradeItemBoundaryRow[]
  gradeOverrides: ArchiveGradeOverrideRow[]
  gradeFrozenScores: ArchiveGradeFrozenScoreRow[]
  gradeItemExclusions: ArchiveGradeItemExclusionRow[]
  gradeConstraints: ArchiveGradeConstraintRow[]
  gradeConstraintViewpoints: ArchiveGradeConstraintViewpointRow[]
  gradeConstraintLabelValues: ArchiveGradeConstraintLabelValueRow[]
  gradeConstraintExclusionLabels: ArchiveGradeConstraintExclusionLabelRow[]
  gradeIndividualReportSettings: ArchiveGradeIndividualReportSettingsRow[]
}

// =============================================================================
// 外部参照（アーカイブに含めない実体を取り込み先で同定するための情報）
// =============================================================================

/**
 * 参照している試験の同定情報。
 *
 * 試験そのものは .grade に含められない（答案画像を伴う別アーカイブの領分）ため、
 * uuid が当たらなければ試験名で当てる。名前は unique ではないので一次キーにはしない。
 */
export interface ArchiveGradeExamRef {
  id: string
  examName: string
  examDate: string | null
}

/**
 * 参照している小計の同定情報。
 * 小計名は `@@unique([subtotalGroupId, name])` でグループ内でしか一意でないため、
 * 名前で当てるときは必ず所属試験で絞る。
 */
export interface ArchiveGradeSubtotalRef {
  id: string
  examId: string
  name: string
}

/**
 * 参照している採点領域の同定情報。
 * 領域ラベルは同一試験内でも重複しうるので、名前フォールバックは最初の1件に当たる。
 */
export interface ArchiveGradeCropRegionRef {
  id: string
  examId: string
  label: string
}

/**
 * 外部参照セクション。
 *
 * 生徒・学級・所属は coursework-archive と同形の full レコードで carry し、
 * uuid 一次 → 学籍番号 / 学級名 のフォールバックで取り込み先の実体へ解決する。
 * 試験・小計・採点領域は carry できないので同定情報だけを添える。
 */
interface GradeExternalSections {
  studentsData: ArchiveCwStudent[]
  classesData: ArchiveCwClass[]
  membershipsData: ArchiveCwMembership[]
  examRefs: ArchiveGradeExamRef[]
  subtotalRefs: ArchiveGradeSubtotalRef[]
  cropRegionRefs: ArchiveGradeCropRegionRef[]
}

/** 収集結果（export 側が組み立て、archiveCreator が JSON へ書く） */
export interface CollectedGradeData
  extends GradeSections, GradeExternalSections {
  /** 内包する試験外成績資料。収集・生成は coursework-archive モジュールへ委譲 */
  courseworkArchive: CollectedCourseworkData
  counts: GradeArchiveManifest["counts"]
}

/** アーカイブ全体（manifest + 各セクション） */
export interface GradeArchiveData extends GradeSections, GradeExternalSections {
  manifest: GradeArchiveManifest
  courseworkArchive: CollectedCourseworkData
}

// =============================================================================
// インポート
// =============================================================================

/** インポート実行時のオプション */
export interface GradeArchiveImportOptions {
  /** 試験参照のマッピング（examName → 既存examId） */
  examMapping?: Record<string, string>
  /** 資料ごとの取り込み判断（archiveCourseworkId → 決定）。未指定の資料はuuid一致なら流用、無ければ新規 */
  courseworkDecisions?: CourseworkImportDecisions
}

/** 資料1件分のマッチング候補（ウィザードでユーザーに提示） */
export interface GradeArchiveCourseworkMatch {
  /** アーカイブ内の資料uuid（決定マップのキー） */
  archiveId: string
  name: string
  itemCount: number
  studentCount: number
  /** uuid完全一致した既存資料（同一PC由来） */
  uuidMatch: { id: string; name: string } | null
  /** 名前一致した既存資料の候補（名前は非ユニークなので複数あり得る） */
  nameCandidates: { id: string; name: string }[]
}

export interface GradeArchiveImportPreview {
  manifest: GradeArchiveManifest
  classroomMatches: { found: boolean; name: string }[]
  /** 既存に一致せず、取り込みで新規作成される学級の数 */
  classroomCreateCount: number
  examMatches: {
    examName: string
    found: boolean
    examId: string | null
  }[]
  /** uuid または学籍番号で既存の生徒に一致した数 */
  studentMatchCount: number
  /** 既存に一致せず、取り込みで新規作成される生徒の数 */
  studentCreateCount: number
  /**
   * 既存に一致せず、作成もできない生徒の数。
   * 旧アーカイブ（v1.12.0 以前）は生徒の氏名を持ち出していないため作成できない。
   * この生徒の名簿行・上書き・確定値・除外設定は取り込まれない。
   */
  studentSkipCount: number
  /** 埋め込み資料ごとのマッチング候補（ユーザー判断用） */
  courseworkMatches: GradeArchiveCourseworkMatch[]
  /**
   * 旧バージョンからの変換で失われるデータの警告（取り込み前に見せる）。
   * 例: v1.10.0 で撤去された総合の境界セット・上書きの破棄。
   * 取り込み後のトーストだけでは「確定してから知る」ことになるため preview にも載せる。
   */
  warnings: string[]
}

// =============================================================================
// バージョン
// =============================================================================

/**
 * アーカイブバージョン（追加時にユニオンへ足す）
 *
 * - 1.3.0: 外部成績は manual-scores.json（manual型 DataSource）
 * - 1.4.0: courseworks.json に名前ベースで埋め込み
 * - 1.5.0: courseworks.json を coursework-archive 形式（UUIDベース）で内包
 * - 1.6.0: GradeDataSource.maxScore 列を廃止（満点はライブ算出）
 * - 1.7.0: 観点間の制約ルール（GradeConstraint）を追加
 * - 1.8.0: 資料全体を参照する coursework_total 型 DataSource を追加
 * - 1.9.0: 成績値の確定（GradeFrozenScore）を追加
 * - 1.10.0: 総合（overall）を撤去。外部参照の照合を uuid 一次・名前二次へ
 * - 1.11.0: 制約ルールの設定JSON（config）を構造化フィールドへ
 * - 1.12.0: 内包資料を coursework 1.1.0（テーブルごとの平坦なセクション）へ
 * - 1.13.0: 成績本体もテーブルごとの平坦なセクションへ変更し、各行を Prisma の行のまま持つ。
 *   外部参照は uuid 一次・名前二次（生徒・学級は full レコードを carry）。
 *   上書き・確定値・除外設定の参照が studentNumber → gradeStudentId（#962 Phase C）
 * - 1.14.0: 境界セット（GradeBoundarySet）を畳み、境界を評価項目へ直付け。
 *   gradeBoundarySets / gradeBoundaries → gradeItemBoundaries（参照が gradeItemId へ）
 * - 1.15.0: 出力設定の JSON（GradeExportSettings.settingsJson）を列へ割る。
 *   gradeExportSettings → gradeIndividualReportSettings（個人成績通知書の設定が列に並ぶ）
 *
 * 検出は manifest.version 文字列ではなくデータ形状で行う（旧アーカイブのバージョン
 * 表記が不正確でも確実に正規化するため。詳細は grade-transformers/index.ts）。
 */
export type GradeArchiveVersion =
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
export const GRADE_CURRENT_VERSION: GradeArchiveVersion = "1.15.0"

// バージョン変換の型（版ごとのアーカイブ全体の型・変換器・チェーン）は
// electron-src/lib/import/grade-transformers/types.ts が持つ。
// 旧版の形の知識をこのファイルへ持ち込まないこと。
