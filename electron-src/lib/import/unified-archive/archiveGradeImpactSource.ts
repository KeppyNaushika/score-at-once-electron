/**
 * 統合アーカイブ（.sao）の試し取り込みで、変わった行を成績算出の評価項目へ写すための手がかりを読む
 *
 * docs/unified-archive-design.md §7.5。**辿る計算と写し方は renderer が持つ**
 * （`src/components/unified-archive/import/archiveGradeImpact.ts`）。ここは試し取り込みの
 * トランザクションの中（書いた後・ロールバックする前 ＝ 取り込み後の状態）で、次の生の行を返すだけ:
 *
 * 1. **参照の先の行**: 書いた行（前と後の両方）の外部キーを、登録表（`ARCHIVE_TABLES`）の
 *    references で1段ずつ引いた行。成績算出が読む表の中だけを辿る（採点 → 設問 → ページ → 試験、
 *    資料の点数 → 項目 → 資料、上書き → 名簿 → 成績算出、など）
 * 2. **使っているデータソース**: 書いた行と参照の先に現れた試験・資料・小計・評価項目を、
 *    成績算出の使われ方の include（`gradeDataSourceUsage.ts`）を同梱して。生徒は載っている
 *    成績算出の名簿を、学級は統計対象にしている成績算出を同梱する
 *
 * 「この id の行をください」を renderer から何度も受ける形にしないのは、取り込み後の状態が
 * 試し取り込みのトランザクションの中にしか無いため（ロールバックした後では引けない）。
 */

import type { Prisma } from "@prisma/client"

import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import {
  courseworkGradeUsageInclude,
  examGradeUsageInclude,
  gradeDataSourceUsageInclude,
  studentGradeRosterInclude,
  subtotalGroupGradeUsageInclude,
} from "../../prisma/gradeDataSourceUsage"
import { GRADE_CALCULATION_TABLES } from "../../prisma/gradeWriteLock"
import type { ArchiveGradeInputChange } from "./archiveGradeInputChanges"
import { prismaArchiveTarget } from "./archiveRowImporter"
import { fetchTargetRows, type TargetRow } from "./archiveTargetRows"

/** 学級を統計対象にしている成績算出（学級の行が変わると、その成績算出の名簿の表示が変わる） */
const classroomGradeInclude = {
  gradeClassrooms: { include: { grade: true } },
} satisfies Prisma.ClassroomInclude

/** 参照の先の1行 */
interface ReferencedRow {
  readonly table: string
  readonly row: TargetRow
}

/** 行の外部キーのうち、成績算出が読む表を指すもの（表 → id） */
const referencedIdsOf = (
  table: string,
  row: TargetRow,
  into: Map<string, Set<string>>
): void => {
  for (const reference of ARCHIVE_TABLES[table]?.references ?? []) {
    if (!GRADE_CALCULATION_TABLES.has(reference.table)) continue
    const referencedId = row[reference.column]
    if (typeof referencedId !== "string") continue
    let ids = into.get(reference.table)
    if (!ids) {
      ids = new Set()
      into.set(reference.table, ids)
    }
    ids.add(referencedId)
  }
}

/** 書いた行から参照を1段ずつ辿り、辿り着いた行を返す（書いた行そのものは含めない） */
async function fetchReferencedRows(
  tx: Prisma.TransactionClient,
  gradeInputChanges: readonly ArchiveGradeInputChange[]
): Promise<ReferencedRow[]> {
  const target = prismaArchiveTarget(tx)
  const seenIds = new Map<string, Set<string>>()
  const markSeen = (table: string, id: string): void => {
    let ids = seenIds.get(table)
    if (!ids) {
      ids = new Set()
      seenIds.set(table, ids)
    }
    ids.add(id)
  }
  let frontier: ReferencedRow[] = gradeInputChanges.flatMap((change) => {
    markSeen(change.table, change.id)
    return [
      { table: change.table, row: change.after },
      ...(change.before ? [{ table: change.table, row: change.before }] : []),
    ]
  })
  const referencedRows: ReferencedRow[] = []
  while (frontier.length > 0) {
    const wanted = new Map<string, Set<string>>()
    for (const { table, row } of frontier) referencedIdsOf(table, row, wanted)
    frontier = []
    for (const [table, ids] of wanted) {
      const unseenIds = [...ids].filter((id) => !seenIds.get(table)?.has(id))
      if (unseenIds.length === 0) continue
      const rowsById = await fetchTargetRows(target, table, unseenIds)
      for (const id of unseenIds) markSeen(table, id)
      for (const row of rowsById.values()) frontier.push({ table, row })
    }
    referencedRows.push(...frontier)
  }
  return referencedRows
}

/**
 * 試し取り込みの中で、成績算出への影響の手がかりを読む（`analyzeUnifiedArchiveImport` の
 * `inspect` に渡す）
 */
export async function collectArchiveGradeImpactSource(
  tx: Prisma.TransactionClient,
  gradeInputChanges: readonly ArchiveGradeInputChange[]
) {
  const referencedRows = await fetchReferencedRows(tx, gradeInputChanges)
  const reachedIds = (table: string): string[] => [
    ...new Set([
      ...gradeInputChanges
        .filter((change) => change.table === table)
        .map((change) => change.id),
      ...referencedRows.flatMap((referenced) =>
        referenced.table === table && typeof referenced.row.id === "string"
          ? [referenced.row.id]
          : []
      ),
    ]),
  ]
  const examIds = reachedIds("Exam")
  const courseworkIds = reachedIds("Coursework")
  const subtotalIds = reachedIds("Subtotal")
  const gradeItemIds = reachedIds("GradeItem")
  const studentIds = reachedIds("Student")
  const classroomIds = reachedIds("Classroom")
  const [exams, courseworks, subtotals, gradeItems, students, classrooms] =
    await Promise.all([
      examIds.length > 0
        ? tx.exam.findMany({
            where: { id: { in: examIds } },
            include: examGradeUsageInclude,
          })
        : [],
      courseworkIds.length > 0
        ? tx.coursework.findMany({
            where: { id: { in: courseworkIds } },
            include: courseworkGradeUsageInclude,
          })
        : [],
      subtotalIds.length > 0
        ? tx.subtotal.findMany({
            where: { id: { in: subtotalIds } },
            include: subtotalGroupGradeUsageInclude.subtotals.include,
          })
        : [],
      gradeItemIds.length > 0
        ? tx.gradeItem.findMany({
            where: { id: { in: gradeItemIds } },
            include: gradeDataSourceUsageInclude.gradeItem.include,
          })
        : [],
      studentIds.length > 0
        ? tx.student.findMany({
            where: { id: { in: studentIds } },
            include: studentGradeRosterInclude,
          })
        : [],
      classroomIds.length > 0
        ? tx.classroom.findMany({
            where: { id: { in: classroomIds } },
            include: classroomGradeInclude,
          })
        : [],
    ])
  return {
    referencedRows,
    exams,
    courseworks,
    subtotals,
    gradeItems,
    students,
    classrooms,
  }
}
