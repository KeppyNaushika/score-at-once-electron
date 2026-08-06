/**
 * v1.12.0 以前（射影形式）の .grade の形と、v1.13.0 の平坦なセクションへの展開。
 *
 * 旧形式は「成績本体を入れ子へ射影し、外部参照を名前で持つ」形だった。
 * 生徒は学籍番号、評価項目は名前（v1.10.0 以降は uuid 併記）で参照しており、
 * 行の id も createdAt/updatedAt も持たない行が多い。
 *
 * 展開では、id を持たない行の id を自然キーから組み立てる
 * （同じアーカイブを何度読んでも同じ id になる＝冪等）。
 * 組み立てた id はアーカイブ内の結合キーとしてのみ使い、DB へは書き込まない
 * （import は全ての行を新しい uuid で作る）。
 *
 * 旧形式の知識はこのファイルだけが持つ。`src/types/gradeArchive.types.ts` は
 * 現行の形だけを宣言する。
 */

import type {
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  CollectedCourseworkData,
} from "../../../../src/types/courseworkArchive.types"
import type {
  ArchiveGradeClassroomRow,
  ArchiveGradeConstraintExclusionLabelRow,
  ArchiveGradeConstraintLabelValueRow,
  ArchiveGradeConstraintRow,
  ArchiveGradeConstraintViewpointRow,
  ArchiveGradeCropRegionRef,
  ArchiveGradeDataSourceEstimationSourceRow,
  ArchiveGradeDataSourceRow,
  ArchiveGradeExamRef,
  ArchiveGradeExportSettingsRow,
  ArchiveGradeFrozenScoreRow,
  ArchiveGradeItemExclusionRow,
  ArchiveGradeItemRow,
  ArchiveGradeOverrideRow,
  ArchiveGradeRow,
  ArchiveGradeStudentRow,
  ArchiveGradeSubtotalRef,
  GradeArchiveManifest,
  GradeSections,
} from "../../../../src/types/gradeArchive.types"
import type { LegacyCollectedCourseworkData } from "../coursework-transformers/legacyShape"

// =============================================================================
// v1.13.0 の形状定義（境界セットを畳む前。1.14.0 との差分だけを宣言する）
// =============================================================================

/**
 * v1.13.0 の GradeBoundarySet（評価項目ごとの成績境界セット）の行。
 * 属性を持たない容器で、1.14.0 で畳まれた。
 */
export interface ArchiveGradeBoundarySetRowV1_13_0 {
  id: string
  gradeId: string
  gradeItemId: string
  createdAt: string
  updatedAt: string
}

/** v1.13.0 の GradeBoundary（境界1本）の行。親はセットで、評価項目は間接参照だった */
export interface ArchiveGradeBoundaryRowV1_13_0 {
  id: string
  gradeBoundarySetId: string
  label: string
  /** Decimal */
  minPercentage: string
  order: number
  createdAt: string
  updatedAt: string
}

/** v1.13.0 の成績本体セクション群 */
type GradeSectionsV1_13_0 = Omit<GradeSections, "gradeItemBoundaries"> & {
  gradeBoundarySets: ArchiveGradeBoundarySetRowV1_13_0[]
  gradeBoundaries: ArchiveGradeBoundaryRowV1_13_0[]
}

// =============================================================================
// v1.12.0 以前の形状定義（ここだけが知っていればよい負債）
// =============================================================================

/** 旧形式のアーカイブ全体 */
export interface LegacyGradeArchiveData {
  manifest: GradeArchiveManifest
  gradeData: LegacyArchiveGradeData
  /**
   * 旧 v1.3.0 以前の外部成績(manual型 DataSource)の点数。
   * v1.4.0 以降は Coursework に昇格したため新規 export では書かない。
   */
  manualScoresData?: LegacyArchiveManualScoresData
  /** v1.4.0: 参照中の試験外成績資料の名前ベース埋め込み */
  courseworks?: LegacyArchiveCoursework[]
  /** v1.12.0: 内包資料を coursework-archive の平坦なセクションで持つ */
  courseworkArchive?: CollectedCourseworkData
  /** v1.5.0〜1.11.0 が内包していた入れ子・射影形式の資料データ */
  legacyCourseworkArchive?: LegacyCollectedCourseworkData
  boundariesData: LegacyArchiveBoundariesData
}

export interface LegacyArchiveGradeData {
  grade: {
    name: string
    description: string | null
    /** v1.2.0+ */
    referenceDate?: string | null
  }
  /** v1.2.0+ */
  exportSettings?: { settingsJson: string } | null
  gradeItems: LegacyArchiveGradeItem[]
  /** 対象学級。v1.10.0+ は uuid を持つ */
  classroomRefs: { id?: string; name: string }[]
  /** 参照する試験。v1.10.0+ は uuid を持つ */
  examRefs: {
    id?: string
    examName: string
    examDate: string | null
    dataSourceName: string
  }[]
  /** 対象生徒。v1.10.0+ は uuid を持つ */
  studentRefs: {
    id?: string
    studentNumber: string
    classroomName: string | null
    customOrder: number | null
  }[]
  gradeItemExclusions?: {
    studentNumber: string
    gradeItemId?: string
    gradeItemName: string
  }[]
  gradeOverrides?: {
    studentNumber: string
    /**
     * @deprecated v1.10.0 で総合（overall）を撤去。"overall" の行は transformer が破棄する。
     */
    targetType?: string
    gradeItemId?: string
    /** v1.10.0 以降は必ず非null（旧アーカイブでは null = 総合） */
    gradeItemName: string | null
    overrideLabel: string
  }[]
  /** v1.9.0+。確定操作者は持ち出していない */
  gradeFrozenScores?: {
    studentNumber: string
    gradeItemId?: string
    gradeItemName: string
    weightedScore: number | null
    weightedMaxScore: number
    percentage: number | null
    gradeLabel: string | null
    frozenAt: string
  }[]
  /** v1.7.0+ */
  gradeConstraints?: LegacyArchiveGradeConstraint[]
}

export interface LegacyArchiveGradeConstraint {
  name: string
  kind: string
  /**
   * @deprecated v1.11.0 で廃止。kind別の設定JSON（評価項目を名前で参照していた）。
   */
  config?: string
  targetGradeItemId?: string | null
  targetGradeItemName?: string | null
  aggregate?: string
  tolerance?: number
  viewpointGradeItemIds?: string[]
  viewpointGradeItemNames?: string[]
  labelValues?: Record<string, number>
  exclusionLabels?: string[]
  expression: string
  color: string
  message: string | null
  enabled: boolean
  order: number
}

export interface LegacyArchiveGradeItem {
  /** v1.10.0+ */
  id?: string
  name: string
  order: number
  dataSources: LegacyArchiveDataSource[]
}

export interface LegacyArchiveDataSource {
  /** v1.11.0+ */
  id?: string
  type: string
  name: string
  /**
   * @deprecated v1.6.0 で GradeDataSource.maxScore 列が廃止された。
   * 旧 1.3.0 の "manual" 型では CourseworkItem.maxScore の出所になるので残す。
   */
  maxScore?: number
  weight: number
  order: number
  examName: string | null
  subtotalName: string | null
  cropRegionLabel: string | null
  absentMethod?: string
  absentRatio?: number
  absentOffset?: number
  treatExpectedAsMissing?: boolean
  estimationMode?: string
  estimationSourceIds?: string[]
  courseworkId?: string | null
  courseworkItemId?: string | null
  courseworkName?: string | null
  courseworkItemName?: string | null
  /** v1.10.0+ */
  examId?: string | null
  subtotalId?: string | null
  cropRegionId?: string | null
  /** 旧 v1.3.0 の入力モード（読取専用） */
  inputMode?: string
  /** 旧 v1.3.0 の文字評価→点数の変換表（読取専用） */
  letterScales?: { label: string; score: number; order: number }[]
}

/** v1.4.0 の名前ベース資料埋め込み */
export interface LegacyArchiveCoursework {
  id: string
  name: string
  description: string | null
  date: string | null
  classrooms: { classroomName: string; order: number }[]
  tags: { tagName: string }[]
  students: { studentNumber: string; customOrder: number | null }[]
  items: LegacyArchiveCourseworkItem[]
}

export interface LegacyArchiveCourseworkItem {
  id: string
  name: string
  order: number
  maxScore: number
  inputMode: string
  letterScales: { label: string; score: number; order: number }[]
  scores: {
    studentNumber: string
    score: number | null
    letterValue: string | null
    adjustment: number | null
    adjustmentReason: string | null
    comment: string | null
  }[]
}

export interface LegacyArchiveManualScoresData {
  manualScores: {
    gradeItemName: string
    dataSourceName: string
    studentNumber: string
    score: number | null
    letterValue?: string | null
    adjustment?: number | null
    adjustmentReason?: string | null
    comment?: string | null
  }[]
}

export interface LegacyArchiveBoundariesData {
  boundarySets: {
    /**
     * @deprecated v1.10.0 で総合（overall）を撤去。"overall" のセットは transformer が破棄する。
     */
    targetType?: string
    gradeItemId?: string
    /** v1.10.0 以降は必ず非null（旧アーカイブでは null = 総合） */
    gradeItemName: string | null
    boundaries: {
      label: string
      minPercentage: number
      order: number
    }[]
  }[]
}

// =============================================================================
// 展開（v1.12.0 以前の射影形式 → v1.13.0 の平坦なセクション）
// =============================================================================

/** 復元できない日時の下限値。LWW で既存を上書きしない */
const UNKNOWN_TIMESTAMP = new Date(0).toISOString()

/** 自然キーから決定論的に組み立てる結合行の id（アーカイブ内でのみ使い、DBへは書かない） */
const joinIds = (parentId: string, childKey: string): string =>
  `${parentId}:${childKey}`

/** 旧形式は数値で持っていた Decimal を、現行の文字列表現へ揃える */
const toDecimalString = (value: number | null | undefined): string =>
  String(value ?? 0)

const toOptionalDecimalString = (
  value: number | null | undefined
): string | null =>
  value === null || value === undefined ? null : String(value)

/**
 * 旧形式が持つ生徒参照から uuid を決める。
 * v1.10.0+ は uuid を持つのでそれを使う。無い場合は学籍番号から組み立てる
 * （取り込み先の実 uuid には当たらないので、学籍番号の二次照合へ落ちる＝旧来の挙動）。
 */
const legacyStudentId = (reference: {
  id?: string
  studentNumber: string
}): string => reference.id ?? `legacy-student:${reference.studentNumber}`

/** 学級も同様。v1.10.0+ は uuid を持つ */
const legacyClassroomId = (reference: { id?: string; name: string }): string =>
  reference.id ?? `legacy-classroom:${reference.name}`

/** 展開結果。セクション群と外部参照、および失われたものの警告 */
interface FlattenedLegacyGrade {
  sections: GradeSectionsV1_13_0
  studentsData: ArchiveCwStudent[]
  classesData: ArchiveCwClass[]
  membershipsData: ArchiveCwMembership[]
  examRefs: ArchiveGradeExamRef[]
  subtotalRefs: ArchiveGradeSubtotalRef[]
  cropRegionRefs: ArchiveGradeCropRegionRef[]
  warnings: string[]
}

/**
 * 旧形式の成績データを平坦なセクションへ展開する。
 *
 * 評価項目・データソースは v1.10.0/v1.11.0 以降 uuid を持つ。持たない旧アーカイブでは
 * 名前から組み立てる（同一成績内で名前が重複していると1つに畳まれるが、旧 importer も
 * 名前でしか照合できておらず同じ結果になる）。
 */
export function flattenLegacyGrade(
  data: LegacyGradeArchiveData
): FlattenedLegacyGrade {
  const warnings: string[] = []
  const { gradeData, boundariesData } = data
  const gradeId = data.manifest.gradeId

  const grade: ArchiveGradeRow = {
    id: gradeId,
    name: gradeData.grade.name,
    description: gradeData.grade.description,
    referenceDate: gradeData.grade.referenceDate ?? null,
    createdAt: UNKNOWN_TIMESTAMP,
    updatedAt: UNKNOWN_TIMESTAMP,
  }

  // ── 評価項目とデータソース ─────────────────────────────────
  const gradeItems: ArchiveGradeItemRow[] = []
  const gradeDataSources: ArchiveGradeDataSourceRow[] = []
  const estimationSources: ArchiveGradeDataSourceEstimationSourceRow[] = []
  /** 評価項目名 → id（旧形式の名前参照を解決するため） */
  const gradeItemIdByName = new Map<string, string>()
  /**
   * 名前が重複し、名前フォールバックでは一意に定まらない評価項目名。
   * GradeItem に (gradeId, name) の unique は無いので実際に起こる。
   * 取り違えるより落とす（境界・上書き・確定値は成績そのもので、
   * 誤った項目へ付けるほうが害が大きい）。
   */
  const ambiguousGradeItemNames = new Set<string>()

  // 旧形式は参照先の試験・小計・採点領域を名前でしか持たないことがある
  // （v1.10.0 未満）。行は uuid しか持てないので、名前から決定論的な id を組み立て、
  // 同定情報は refs セクションへ添える（取り込み側が名前で当て直す）。
  const examRefs: ArchiveGradeExamRef[] = []
  const subtotalRefs: ArchiveGradeSubtotalRef[] = []
  const cropRegionRefs: ArchiveGradeCropRegionRef[] = []
  const seenExamIds = new Set<string>()
  const seenSubtotalIds = new Set<string>()
  const seenCropRegionIds = new Set<string>()

  // 内包資料は変換済み（1.11.0→1.12.0 が先に走る）。旧形式のデータソースが資料を
  // 名前でしか参照していない場合に備え、名前 → uuid の索引を作る
  const courseworkIdByName = new Map<string, string>()
  const courseworkItemIdByName = new Map<string, string>()
  if (data.courseworkArchive) {
    const courseworkNameById = new Map<string, string>()
    for (const coursework of data.courseworkArchive.courseworks) {
      courseworkNameById.set(coursework.id, coursework.name)
      if (!courseworkIdByName.has(coursework.name)) {
        courseworkIdByName.set(coursework.name, coursework.id)
      }
    }
    for (const courseworkItem of data.courseworkArchive.courseworkItems) {
      const courseworkName = courseworkNameById.get(courseworkItem.courseworkId)
      if (!courseworkName) continue
      const key = `${courseworkName}:${courseworkItem.name}`
      if (!courseworkItemIdByName.has(key)) {
        courseworkItemIdByName.set(key, courseworkItem.id)
      }
    }
  }

  gradeData.gradeItems.forEach((legacyItem, itemIndex) => {
    // 合成 id には並び順を混ぜる。名前だけだと同名の評価項目が1つの id へ潰れ、
    // 両方のデータソースが片方へ寄ってしまう（重み倍・もう片方は全欠測）。
    // 名前で指す参照の曖昧さは ambiguousGradeItemNames が別途弾く
    const gradeItemId =
      legacyItem.id ?? joinIds(gradeId, `item:${itemIndex}:${legacyItem.name}`)
    if (gradeItemIdByName.has(legacyItem.name)) {
      ambiguousGradeItemNames.add(legacyItem.name)
    } else {
      gradeItemIdByName.set(legacyItem.name, gradeItemId)
    }
    gradeItems.push({
      id: gradeItemId,
      gradeId,
      name: legacyItem.name,
      order: legacyItem.order,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })

    for (const legacySource of legacyItem.dataSources) {
      const dataSourceId =
        legacySource.id ?? joinIds(gradeItemId, legacySource.name)

      // 試験: uuid → 試験名から合成
      let examId = legacySource.examId ?? null
      if (!examId && legacySource.examName) {
        examId = `legacy-exam:${legacySource.examName}`
      }
      if (examId && !seenExamIds.has(examId)) {
        seenExamIds.add(examId)
        const examName =
          legacySource.examName ??
          gradeData.examRefs.find((examRef) => examRef.id === examId)
            ?.examName ??
          ""
        if (examName) {
          examRefs.push({
            id: examId,
            examName,
            examDate:
              gradeData.examRefs.find((examRef) => examRef.id === examId)
                ?.examDate ?? null,
          })
        }
      }

      // 小計・採点領域: uuid → 名前から合成。名前で当て直すには試験の絞り込みが要る
      // 合成 id には試験を混ぜる。小計名はグループ内、領域ラベルは試験内でしか
      // 一意でないので、名前だけだと別の試験の同名参照と衝突して取り違える
      let subtotalId = legacySource.subtotalId ?? null
      if (!subtotalId && legacySource.subtotalName && examId) {
        subtotalId = `legacy-subtotal:${examId}:${legacySource.subtotalName}`
      }
      if (subtotalId && examId && legacySource.subtotalName) {
        if (!seenSubtotalIds.has(subtotalId)) {
          seenSubtotalIds.add(subtotalId)
          subtotalRefs.push({
            id: subtotalId,
            examId,
            name: legacySource.subtotalName,
          })
        }
      }

      let cropRegionId = legacySource.cropRegionId ?? null
      if (!cropRegionId && legacySource.cropRegionLabel && examId) {
        cropRegionId = `legacy-crop-region:${examId}:${legacySource.cropRegionLabel}`
      }
      if (cropRegionId && examId && legacySource.cropRegionLabel) {
        if (!seenCropRegionIds.has(cropRegionId)) {
          seenCropRegionIds.add(cropRegionId)
          cropRegionRefs.push({
            id: cropRegionId,
            examId,
            label: legacySource.cropRegionLabel,
          })
        }
      }

      // 資料: uuid → 資料名・評価項目名から内包資料の行を引く
      const courseworkItemId =
        legacySource.courseworkItemId ??
        (legacySource.courseworkName && legacySource.courseworkItemName
          ? (courseworkItemIdByName.get(
              `${legacySource.courseworkName}:${legacySource.courseworkItemName}`
            ) ?? null)
          : null)
      const courseworkId =
        legacySource.courseworkId ??
        (legacySource.courseworkName
          ? (courseworkIdByName.get(legacySource.courseworkName) ?? null)
          : null)

      gradeDataSources.push({
        id: dataSourceId,
        gradeItemId,
        // Project 時代（アプリ v0.5.x 以前）の型名を現行へ直す。
        // 残すと gradeCalculator のどの分岐にも一致せず、その評価項目の
        // 試験合計が理由も示されず全生徒で空欄になる
        type:
          legacySource.type === "project_total"
            ? "exam_total"
            : legacySource.type,
        examId,
        subtotalId,
        cropRegionId,
        courseworkItemId,
        courseworkId,
        name: legacySource.name,
        weight: toDecimalString(legacySource.weight),
        order: legacySource.order,
        absentMethod: legacySource.absentMethod ?? "null",
        absentRatio: toDecimalString(legacySource.absentRatio ?? 1),
        absentOffset: toDecimalString(legacySource.absentOffset ?? 0),
        treatExpectedAsMissing: legacySource.treatExpectedAsMissing ?? false,
        estimationMode: legacySource.estimationMode ?? "all",
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })

      // 推定の参照は export 元のデータソース id を並べていた。id を持たない旧
      // アーカイブでは解決できないので落とす（旧 importer と同じ判断）
      const sourceIds = legacySource.estimationSourceIds ?? []
      sourceIds.forEach((sourceDataSourceId, index) => {
        estimationSources.push({
          id: joinIds(dataSourceId, sourceDataSourceId),
          dataSourceId,
          sourceDataSourceId,
          order: index,
          createdAt: UNKNOWN_TIMESTAMP,
          updatedAt: UNKNOWN_TIMESTAMP,
        })
      })
    }
  })

  let ambiguousReferences = 0
  /** 旧形式のセル参照（uuid 一次・項目名二次）から評価項目 id を解決する */
  const resolveGradeItemId = (reference: {
    gradeItemId?: string
    gradeItemName: string | null
  }): string | null => {
    if (reference.gradeItemId) {
      const byId = gradeItems.find(
        (gradeItem) => gradeItem.id === reference.gradeItemId
      )
      if (byId) return byId.id
    }
    if (reference.gradeItemName === null) return null
    if (ambiguousGradeItemNames.has(reference.gradeItemName)) {
      ambiguousReferences++
      return null
    }
    return gradeItemIdByName.get(reference.gradeItemName) ?? null
  }

  // ── 対象学級・対象者 ───────────────────────────────────────
  const gradeClassrooms: ArchiveGradeClassroomRow[] =
    gradeData.classroomRefs.map((classroomRef, index) => {
      const classroomId = legacyClassroomId(classroomRef)
      return {
        id: joinIds(gradeId, classroomId),
        gradeId,
        classroomId,
        order: index,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      }
    })

  const gradeStudents: ArchiveGradeStudentRow[] = []
  /** 学籍番号 → 対象者 id（セルは学籍番号でしか生徒を指していない） */
  const gradeStudentIdByStudentNumber = new Map<string, string>()
  for (const studentRef of gradeData.studentRefs) {
    const studentId = legacyStudentId(studentRef)
    const gradeStudentId = joinIds(gradeId, studentId)
    gradeStudents.push({
      id: gradeStudentId,
      gradeId,
      studentId,
      customOrder: studentRef.customOrder,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
    if (!gradeStudentIdByStudentNumber.has(studentRef.studentNumber)) {
      gradeStudentIdByStudentNumber.set(
        studentRef.studentNumber,
        gradeStudentId
      )
    }
  }

  // ── セル3種 ───────────────────────────────────────────────
  let droppedCells = 0
  /** 旧形式のセルを (gradeStudentId, gradeItemId) へ解決する。解決できなければ null */
  const resolveCell = (reference: {
    studentNumber: string
    gradeItemId?: string
    gradeItemName: string | null
  }): { gradeStudentId: string; gradeItemId: string } | null => {
    const gradeStudentId = gradeStudentIdByStudentNumber.get(
      reference.studentNumber
    )
    const gradeItemId = resolveGradeItemId(reference)
    if (!gradeStudentId || !gradeItemId) {
      droppedCells++
      return null
    }
    return { gradeStudentId, gradeItemId }
  }

  const gradeOverrides: ArchiveGradeOverrideRow[] = []
  for (const legacyOverride of gradeData.gradeOverrides ?? []) {
    const cell = resolveCell(legacyOverride)
    if (!cell) continue
    gradeOverrides.push({
      id: joinIds(cell.gradeStudentId, cell.gradeItemId),
      gradeStudentId: cell.gradeStudentId,
      gradeItemId: cell.gradeItemId,
      overrideLabel: legacyOverride.overrideLabel,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
  }

  const gradeFrozenScores: ArchiveGradeFrozenScoreRow[] = []
  for (const legacyFrozen of gradeData.gradeFrozenScores ?? []) {
    const cell = resolveCell(legacyFrozen)
    if (!cell) continue
    gradeFrozenScores.push({
      id: joinIds(cell.gradeStudentId, cell.gradeItemId),
      gradeStudentId: cell.gradeStudentId,
      gradeItemId: cell.gradeItemId,
      weightedScore: toOptionalDecimalString(legacyFrozen.weightedScore),
      weightedMaxScore: toDecimalString(legacyFrozen.weightedMaxScore),
      percentage: toOptionalDecimalString(legacyFrozen.percentage),
      gradeLabel: legacyFrozen.gradeLabel,
      // 旧形式は確定操作者を持ち出していない
      frozenByUserId: null,
      frozenAt: legacyFrozen.frozenAt,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
  }

  const gradeItemExclusions: ArchiveGradeItemExclusionRow[] = []
  for (const legacyExclusion of gradeData.gradeItemExclusions ?? []) {
    const cell = resolveCell(legacyExclusion)
    if (!cell) continue
    gradeItemExclusions.push({
      id: joinIds(cell.gradeStudentId, cell.gradeItemId),
      gradeStudentId: cell.gradeStudentId,
      gradeItemId: cell.gradeItemId,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
  }

  if (droppedCells > 0) {
    warnings.push(
      `1.12.0→1.13.0: 対象生徒または評価項目を解決できない上書き・確定値・除外設定 ${droppedCells}件を破棄しました`
    )
  }
  if (ambiguousReferences > 0) {
    warnings.push(
      `1.12.0→1.13.0: 同名の評価項目が複数あり対象を特定できない参照 ${ambiguousReferences}件を破棄しました`
    )
  }

  // ── 境界セット ───────────────────────────────────────────
  const gradeBoundarySets: ArchiveGradeBoundarySetRowV1_13_0[] = []
  const gradeBoundaries: ArchiveGradeBoundaryRowV1_13_0[] = []
  let droppedBoundarySets = 0
  for (const legacySet of boundariesData.boundarySets) {
    const gradeItemId = resolveGradeItemId(legacySet)
    if (!gradeItemId) {
      droppedBoundarySets++
      continue
    }
    const boundarySetId = joinIds(gradeId, gradeItemId)
    gradeBoundarySets.push({
      id: boundarySetId,
      gradeId,
      gradeItemId,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
    for (const legacyBoundary of legacySet.boundaries) {
      gradeBoundaries.push({
        id: joinIds(boundarySetId, legacyBoundary.label),
        gradeBoundarySetId: boundarySetId,
        label: legacyBoundary.label,
        minPercentage: toDecimalString(legacyBoundary.minPercentage),
        order: legacyBoundary.order,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
    }
  }
  if (droppedBoundarySets > 0) {
    warnings.push(
      `1.12.0→1.13.0: 対象の評価項目を解決できない成績境界セット ${droppedBoundarySets}件を破棄しました`
    )
  }

  // ── 制約ルール ───────────────────────────────────────────
  const gradeConstraints: ArchiveGradeConstraintRow[] = []
  const gradeConstraintViewpoints: ArchiveGradeConstraintViewpointRow[] = []
  const gradeConstraintLabelValues: ArchiveGradeConstraintLabelValueRow[] = []
  const gradeConstraintExclusionLabels: ArchiveGradeConstraintExclusionLabelRow[] =
    []
  let droppedViewpoints = 0

  gradeData.gradeConstraints?.forEach((legacyConstraint, constraintIndex) => {
    const constraintId = joinIds(gradeId, `constraint:${constraintIndex}`)
    const targetGradeItemId = legacyConstraint.targetGradeItemId
      ? (resolveGradeItemId({
          gradeItemId: legacyConstraint.targetGradeItemId,
          gradeItemName: legacyConstraint.targetGradeItemName ?? null,
        }) ?? null)
      : (gradeItemIdByName.get(legacyConstraint.targetGradeItemName ?? "") ??
        null)

    // 観点は uuid 配列と名前配列の2本の平行配列で持っていた（同順が前提）。
    // 現行は1行1参照なので、ここで対応を確定させて平行配列を解消する。
    const viewpointIds = legacyConstraint.viewpointGradeItemIds ?? []
    const viewpointNames = legacyConstraint.viewpointGradeItemNames ?? []
    const viewpointCount = Math.max(viewpointIds.length, viewpointNames.length)
    let lostViewpoints = 0
    for (let index = 0; index < viewpointCount; index++) {
      const gradeItemId = resolveGradeItemId({
        gradeItemId: viewpointIds[index],
        gradeItemName: viewpointNames[index] ?? null,
      })
      if (!gradeItemId) {
        droppedViewpoints++
        lostViewpoints++
        continue
      }
      gradeConstraintViewpoints.push({
        id: joinIds(constraintId, gradeItemId),
        constraintId,
        gradeItemId,
        order: index,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
    }

    // 参照を1つでも失うとルールの意味が変わる（集計対象が減れば平均が動き、
    // 比較先を失えば別物になる）。ここで落ちたことは取り込み側からは見えないので、
    // この時点で無効化理由を書き込む。有効のまま通すと、減った観点で判定する
    // 別のルールとして静かに動き続ける
    const lostTarget =
      Boolean(
        legacyConstraint.targetGradeItemId ??
        legacyConstraint.targetGradeItemName
      ) && targetGradeItemId === null
    const disabledReason = lostTarget
      ? "取り込み時に比較先の評価項目を解決できなかったため無効化しました。再設定してください。"
      : lostViewpoints > 0
        ? "取り込み時に集計対象の観点を解決できなかったため無効化しました。再設定してください。"
        : null
    if (disabledReason) {
      warnings.push(
        `1.12.0→1.13.0: 制約ルール「${legacyConstraint.name}」: ${disabledReason}`
      )
    }

    gradeConstraints.push({
      id: constraintId,
      gradeId,
      name: legacyConstraint.name,
      kind: legacyConstraint.kind,
      targetGradeItemId,
      aggregate: legacyConstraint.aggregate ?? "average",
      tolerance: toDecimalString(legacyConstraint.tolerance ?? 1),
      expression: legacyConstraint.expression,
      color: legacyConstraint.color,
      message: legacyConstraint.message,
      disabledReason,
      enabled: legacyConstraint.enabled && !disabledReason,
      order: legacyConstraint.order,
      createdAt: UNKNOWN_TIMESTAMP,
      updatedAt: UNKNOWN_TIMESTAMP,
    })

    Object.entries(legacyConstraint.labelValues ?? {}).forEach(
      ([label, value], index) => {
        gradeConstraintLabelValues.push({
          id: joinIds(constraintId, label),
          constraintId,
          label,
          value: toDecimalString(value),
          order: index,
          createdAt: UNKNOWN_TIMESTAMP,
          updatedAt: UNKNOWN_TIMESTAMP,
        })
      }
    )

    ;(legacyConstraint.exclusionLabels ?? []).forEach((label, index) => {
      gradeConstraintExclusionLabels.push({
        id: joinIds(constraintId, label),
        constraintId,
        label,
        order: index,
        createdAt: UNKNOWN_TIMESTAMP,
        updatedAt: UNKNOWN_TIMESTAMP,
      })
    })
  })

  if (droppedViewpoints > 0) {
    warnings.push(
      `1.12.0→1.13.0: 評価項目を解決できない制約ルールの観点 ${droppedViewpoints}件を破棄しました`
    )
  }

  // ── 出力設定 ─────────────────────────────────────────────
  const gradeExportSettings: ArchiveGradeExportSettingsRow[] =
    gradeData.exportSettings
      ? [
          {
            id: joinIds(gradeId, "exportSettings"),
            gradeId,
            settingsJson: gradeData.exportSettings.settingsJson,
            createdAt: UNKNOWN_TIMESTAMP,
            updatedAt: UNKNOWN_TIMESTAMP,
          },
        ]
      : []

  // ── 外部参照 ─────────────────────────────────────────────
  // 旧形式は生徒・学級の full レコードを持たない（学籍番号・学級名だけ）。
  // 取り込み先の実体と突き合わせるのに必要な最小限を組み立てる。
  // 旧形式は生徒を学籍番号だけで参照しており、氏名を持ち出していない。
  // uuid / 学籍番号での照合は効くが、取り込み先に居ない生徒は作れない
  // （氏名が空の生徒を名簿へ並べるより、作らずに知らせる方が復旧できる）。
  const studentsData: ArchiveCwStudent[] = gradeData.studentRefs.map(
    (studentRef) => ({
      id: legacyStudentId(studentRef),
      studentNumber: studentRef.studentNumber,
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      enrollmentYear: null,
      updatedAt: UNKNOWN_TIMESTAMP,
    })
  )
  if (studentsData.length > 0) {
    warnings.push(
      "1.12.0→1.13.0: 旧アーカイブは生徒の氏名・学級所属を持ちません。" +
        "取り込み先に居ない生徒は作成されないため、先に生徒を登録してください"
    )
  }

  const classesData: ArchiveCwClass[] = gradeData.classroomRefs.map(
    (classroomRef) => ({
      id: legacyClassroomId(classroomRef),
      name: classroomRef.name,
      classroomCode: null,
      grade: null,
      description: null,
      isVisible: true,
    })
  )

  // 旧形式は学級所属（在籍期間・出席番号）を持たない。在籍期間を捏造すると
  // 受験日スナップショットの判定を狂わせるので、復元せず空で渡す。
  // 対象学級そのものは classroomRefs から作られ、成績への紐づけも復元される
  const membershipsData: ArchiveCwMembership[] = []

  // 試験・小計・採点領域の同定情報はデータソースを走査する過程で積んである

  return {
    sections: {
      grades: [grade],
      gradeClassrooms,
      gradeStudents,
      gradeItems,
      gradeDataSources,
      gradeDataSourceEstimationSources: estimationSources,
      gradeBoundarySets,
      gradeBoundaries,
      gradeOverrides,
      gradeFrozenScores,
      gradeItemExclusions,
      gradeConstraints,
      gradeConstraintViewpoints,
      gradeConstraintLabelValues,
      gradeConstraintExclusionLabels,
      gradeExportSettings,
    },
    studentsData,
    classesData,
    membershipsData,
    examRefs,
    subtotalRefs,
    cropRegionRefs,
    warnings,
  }
}

/** 旧形式（射影された gradeData を持つ）か判定する */
export function isLegacyGradeArchiveData(
  value: unknown
): value is LegacyGradeArchiveData {
  if (typeof value !== "object" || value === null) return false
  const gradeData = (value as { gradeData?: unknown }).gradeData
  if (typeof gradeData !== "object" || gradeData === null) return false
  return Array.isArray((gradeData as { gradeItems?: unknown }).gradeItems)
}
