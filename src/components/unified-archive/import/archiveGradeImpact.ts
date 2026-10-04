/**
 * 統合アーカイブ（.sao）の試し取り込みで変わった行を、取り込み先の成績算出の評価項目へ写す
 *
 * docs/unified-archive-design.md §7.5。材料は試し取り込み（IPC `unifiedArchive:analyze`）が
 * 生のまま返すもの:
 * - `gradeInputChanges`: 成績算出が読む表へ書いた行の前と後
 * - `gradeImpactSource`: 書いた行から参照を辿った親の行（取り込み後の状態）と、試験・資料・
 *   小計・評価項目・生徒・学級の、成績算出での使われ方の include
 *
 * 差分は `archiveGradeInputDiff.ts`、写し方はここ。使われ方の導出は削除・ロックの確認と同じ
 * `gradeReferenceMessages.ts` の関数を使う。粒度は「値が実際に変わりそうな評価項目だけ」:
 * - 採点（採点・確定・受験生）は、その試験を使うデータソースへ。設問を指すデータソースは、
 *   その設問の採点が変わったときだけ。生徒1人の行は、その生徒が名簿に載る成績算出だけ
 * - 設問・ページ・小計の構成は、それを使うデータソースへ
 * - 資料（点数・項目・段階・対象生徒・資料）は、その資料・項目を使うデータソースへ
 * - 成績算出の中の行は、その評価項目へ（評価項目が分からない行は成績算出の設定・名簿として）
 * - 名簿（生徒・在籍・学級）は、その生徒が名簿に載る・その学級を統計対象にする成績算出へ
 * - 取り込みで新しく作られる成績算出は対象外（取り込み先に既にある成績算出だけ）
 */

import { isFrozenGradeItem } from "@/lib/gradeLock"
import {
  courseworkItemUsages,
  courseworkUsingDataSources,
  cropRegionUsages,
  examPageUsages,
  examUsingDataSources,
  type GradeDataSourceUsage,
  subtotalUsages,
  type UsingGradeDataSource,
} from "@/lib/shared/gradeReferenceMessages"

import { changesGradeInput } from "./archiveGradeInputDiff"
import type { ArchiveGradeImpact, ArchiveGradeItemImpact } from "./types"

type RawRow = Readonly<Record<string, unknown>>
type GradeOfItem = UsingGradeDataSource["gradeItem"]["grade"]

/** 試し取り込みが返す手がかり（IPC の `gradeImpactSource` がこの形を満たす） */
interface ArchiveGradeImpactSource {
  readonly referencedRows: readonly { table: string; row: RawRow }[]
  readonly exams: readonly (Parameters<typeof examUsingDataSources>[0] & {
    id: string
  })[]
  readonly courseworks: readonly (Parameters<
    typeof courseworkUsingDataSources
  >[0] & { id: string })[]
  readonly subtotals: readonly (Parameters<typeof subtotalUsages>[0] & {
    id: string
  })[]
  readonly gradeItems: readonly UsingGradeDataSource["gradeItem"][]
  readonly students: readonly {
    id: string
    gradeStudents: readonly { grade: GradeOfItem }[]
  }[]
  readonly classrooms: readonly {
    id: string
    gradeClassrooms: readonly { grade: GradeOfItem }[]
  }[]
}

interface GradeImpactDraft {
  grade: GradeOfItem
  items: Map<string, ArchiveGradeItemImpact>
  rosterChanged: boolean
  settingsChanged: boolean
}

const rowKey = (table: string, id: string): string => `${table}:${id}`

const stringOf = (row: RawRow | undefined, column: string): string | null => {
  const value = row?.[column]
  return typeof value === "string" ? value : null
}

/** 取り込みで変わった行を、値が変わりそうな成績算出と評価項目へ写す */
export function mapArchiveGradeImpacts(
  gradeInputChanges: readonly {
    table: string
    id: string
    before: RawRow | null
    after: RawRow
  }[],
  source: ArchiveGradeImpactSource
): ArchiveGradeImpact[] {
  const newGradeIds = new Set(
    gradeInputChanges
      .filter((change) => change.table === "Grade" && change.before === null)
      .map((change) => change.id)
  )
  const rowsByKey = new Map<string, RawRow>()
  for (const referenced of source.referencedRows) {
    const id = stringOf(referenced.row, "id")
    if (id !== null) rowsByKey.set(rowKey(referenced.table, id), referenced.row)
  }
  for (const change of gradeInputChanges) {
    rowsByKey.set(rowKey(change.table, change.id), change.after)
  }
  const rowOf = (table: string, id: string | null): RawRow | undefined =>
    id === null ? undefined : rowsByKey.get(rowKey(table, id))
  const byId = <Entity extends { id: string }>(
    entities: readonly Entity[]
  ): Map<string, Entity> =>
    new Map(entities.map((entity) => [entity.id, entity]))
  const examById = byId(source.exams)
  const courseworkById = byId(source.courseworks)
  const subtotalById = byId(source.subtotals)
  const gradeItemById = byId(source.gradeItems)
  const studentById = byId(source.students)
  const classroomById = byId(source.classrooms)

  // ── 写し先を集める ─────────────────────────────────────────
  const drafts = new Map<string, GradeImpactDraft>()
  const draftOf = (grade: GradeOfItem): GradeImpactDraft | null => {
    if (newGradeIds.has(grade.id)) return null
    let draft = drafts.get(grade.id)
    if (!draft) {
      draft = {
        grade,
        items: new Map(),
        rosterChanged: false,
        settingsChanged: false,
      }
      drafts.set(grade.id, draft)
    }
    return draft
  }
  const addGradeItem = (
    gradeItem: UsingGradeDataSource["gradeItem"] | undefined,
    frozenScoresReplaced = false
  ): void => {
    if (!gradeItem) return
    const draft = draftOf(gradeItem.grade)
    if (!draft) return
    const current = draft.items.get(gradeItem.id)
    draft.items.set(gradeItem.id, {
      gradeItem,
      frozen: isFrozenGradeItem(gradeItem),
      frozenScoresReplaced:
        frozenScoresReplaced || (current?.frozenScoresReplaced ?? false),
    })
  }
  /** 生徒1人の行なら、その生徒が名簿に載る成績算出だけに絞る */
  const addDataSources = (
    dataSources: readonly UsingGradeDataSource[],
    studentId: string | null
  ): void => {
    const rosterGradeIds =
      studentId === null
        ? null
        : new Set(
            (studentById.get(studentId)?.gradeStudents ?? []).map(
              (gradeStudent) => gradeStudent.grade.id
            )
          )
    for (const dataSource of dataSources) {
      if (rosterGradeIds && !rosterGradeIds.has(dataSource.gradeItem.grade.id))
        continue
      addGradeItem(dataSource.gradeItem)
    }
  }
  const addUsages = (
    usages: readonly GradeDataSourceUsage[],
    studentId: string | null
  ): void =>
    addDataSources(
      usages.map((usage) => usage.dataSource),
      studentId
    )
  const markGrade = (
    grade: GradeOfItem | null,
    change: "rosterChanged" | "settingsChanged"
  ): void => {
    const draft = grade === null ? null : draftOf(grade)
    if (draft) draft[change] = true
  }
  const gradeOfRow = (row: RawRow | undefined): GradeOfItem | null => {
    const id = stringOf(row, "id")
    const name = stringOf(row, "name")
    return id !== null && name !== null ? { id, name } : null
  }

  // ── 行をたどる ─────────────────────────────────────────────
  const examOfPage = (examPageId: string | null) => {
    const examId = stringOf(rowOf("ExamPage", examPageId), "examId")
    return examId === null ? undefined : examById.get(examId)
  }
  const examOfCropRegion = (cropRegionId: string | null) =>
    examOfPage(stringOf(rowOf("CropRegion", cropRegionId), "examPageId"))
  const courseworkOfItem = (courseworkItemId: string | null) => {
    const courseworkId = stringOf(
      rowOf("CourseworkItem", courseworkItemId),
      "courseworkId"
    )
    return courseworkId === null ? undefined : courseworkById.get(courseworkId)
  }
  const addCourseworkItem = (
    courseworkItemId: string | null,
    studentId: string | null
  ): void => {
    const coursework = courseworkOfItem(courseworkItemId)
    if (coursework && courseworkItemId !== null) {
      addUsages(courseworkItemUsages(coursework, courseworkItemId), studentId)
    }
  }
  const addRosterOfStudent = (studentId: string | null): void => {
    const student = studentId === null ? undefined : studentById.get(studentId)
    for (const gradeStudent of student?.gradeStudents ?? []) {
      markGrade(gradeStudent.grade, "rosterChanged")
    }
  }

  const mapRow = (table: string, id: string, row: RawRow): void => {
    switch (table) {
      case "QuestionScore":
      case "ScoreDecision": {
        const cropRegionId = stringOf(row, "cropRegionId")
        const exam = examOfCropRegion(cropRegionId)
        if (!exam || cropRegionId === null) return
        const studentId = stringOf(
          rowOf("ExamStudent", stringOf(row, "examStudentId")),
          "studentId"
        )
        addUsages(cropRegionUsages(exam, cropRegionId), studentId)
        return
      }
      case "ExamStudent": {
        const exam = examById.get(stringOf(row, "examId") ?? "")
        if (exam) {
          addDataSources(examUsingDataSources(exam), stringOf(row, "studentId"))
        }
        return
      }
      case "Exam": {
        const exam = examById.get(id)
        if (exam) addDataSources(examUsingDataSources(exam), null)
        return
      }
      case "ExamPage": {
        const exam = examById.get(stringOf(row, "examId") ?? "")
        if (exam) addUsages(examPageUsages(exam, id), null)
        return
      }
      case "CropRegion": {
        const exam = examOfPage(stringOf(row, "examPageId"))
        if (exam) addUsages(cropRegionUsages(exam, id), null)
        return
      }
      case "CropSubtotal": {
        const subtotalId = stringOf(row, "subtotalId")
        const exam = examOfCropRegion(stringOf(row, "cropRegionId"))
        if (!exam) return
        addDataSources(
          exam.gradeDataSources.filter(
            (dataSource) =>
              dataSource.type === "subtotal" &&
              dataSource.subtotalId === subtotalId
          ),
          null
        )
        return
      }
      case "Subtotal": {
        const subtotal = subtotalById.get(id)
        if (subtotal) addUsages(subtotalUsages(subtotal), null)
        return
      }
      case "Coursework": {
        const coursework = courseworkById.get(id)
        if (coursework) {
          addDataSources(courseworkUsingDataSources(coursework), null)
        }
        return
      }
      case "CourseworkStudent": {
        const coursework = courseworkById.get(
          stringOf(row, "courseworkId") ?? ""
        )
        if (coursework) {
          addDataSources(
            courseworkUsingDataSources(coursework),
            stringOf(row, "studentId")
          )
        }
        return
      }
      case "CourseworkItem":
        addCourseworkItem(id, null)
        return
      case "CourseworkLetterScale":
        addCourseworkItem(stringOf(row, "courseworkItemId"), null)
        return
      case "CourseworkScore":
        addCourseworkItem(
          stringOf(row, "courseworkItemId"),
          stringOf(
            rowOf("CourseworkStudent", stringOf(row, "courseworkStudentId")),
            "studentId"
          )
        )
        return
      case "GradeItem":
        addGradeItem(gradeItemById.get(id))
        return
      case "GradeDataSource":
      case "GradeItemBoundary":
      case "GradeOverride":
      case "GradeItemExclusion":
        addGradeItem(gradeItemById.get(stringOf(row, "gradeItemId") ?? ""))
        return
      case "GradeFrozenScore":
        addGradeItem(
          gradeItemById.get(stringOf(row, "gradeItemId") ?? ""),
          true
        )
        return
      case "GradeDataSourceEstimationSource": {
        const dataSource = rowOf(
          "GradeDataSource",
          stringOf(row, "dataSourceId")
        )
        addGradeItem(
          gradeItemById.get(stringOf(dataSource, "gradeItemId") ?? "")
        )
        return
      }
      case "Grade":
        markGrade(gradeOfRow(row), "settingsChanged")
        return
      case "GradeClassroom":
        markGrade(
          gradeOfRow(rowOf("Grade", stringOf(row, "gradeId"))),
          "settingsChanged"
        )
        return
      case "GradeStudent":
        markGrade(
          gradeOfRow(rowOf("Grade", stringOf(row, "gradeId"))),
          "rosterChanged"
        )
        return
      case "Student":
        addRosterOfStudent(id)
        return
      case "StudentClassroomMembership":
        addRosterOfStudent(stringOf(row, "studentId"))
        return
      case "Classroom":
        for (const gradeClassroom of classroomById.get(id)?.gradeClassrooms ??
          []) {
          markGrade(gradeClassroom.grade, "rosterChanged")
        }
        return
      default:
        return
    }
  }

  for (const change of gradeInputChanges) {
    if (!changesGradeInput(change)) continue
    // 参照の列が変わった行は、前の参照先にも効く（設問を別のページへ移した、など）
    mapRow(change.table, change.id, change.after)
    if (change.before) mapRow(change.table, change.id, change.before)
  }

  return [...drafts.values()]
    .map((draft) => ({
      grade: draft.grade,
      items: [...draft.items.values()].sort(
        (itemA, itemB) => itemA.gradeItem.order - itemB.gradeItem.order
      ),
      rosterChanged: draft.rosterChanged,
      settingsChanged: draft.settingsChanged,
    }))
    .sort((impactA, impactB) =>
      impactA.grade.name.localeCompare(impactB.grade.name)
    )
}
