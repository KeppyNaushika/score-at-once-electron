/**
 * 取り込みのあとに並び順を詰め直す
 *
 * **並び順は行の事実ではなく、列全体の性質。** 行 A の `3` は B の `4` があって初めて
 * 意味を持つ。だから取り込みの規則（行ごとに値を置き換える）を並び順の列にそのまま
 * 当てると、取り込み先にしか無い行とアーカイブにしか無い行が混ざったときに
 * **番号の重複と穴**ができる。
 *
 * 規則から並び順を例外にはしない（例外は名指しの一覧でしか管理しない決まりで、
 * 並び順はその一覧に無い）。代わりに**帰結の方を直す** — 行ごとの規則はそのまま当てて、
 * 取り込みが終わったあとに、その名簿・その一覧をまるごと 1..n へ詰め直す。
 * 列全体の性質は列全体の操作で回復させる。
 *
 * **行が増減したときだけ走らせる。** 毎回無条件に詰め直すと、触っていない名簿の並びまで
 * 書き換えて updatedAt が動き、同期でも「変更あり」として流れてしまう。
 *
 * 並べ替えの基準は「いま入っている順」。同じ番号が並んだとき（＝取り込みで重なったとき）の
 * 決着は、それぞれの表で人が見ている順（生徒なら学籍番号、学級なら名前）に倒す。
 * 番号を持たない行（null）は最後に置く。
 */

import type { PrismaTransaction } from "./types"

/**
 * 詰め直しに要る分だけの Prisma クライアント。
 *
 * 試験の取り込みと資料の取り込みでトランザクション型の宣言が違う（前者は
 * `PrismaTransaction`、後者は `TransactionClient`）ため、使う delegate だけを取り出して
 * どちらからも渡せるようにする。
 */
type ReorderClient = Pick<
  PrismaTransaction,
  | "examStudent"
  | "examClassroom"
  | "subtotal"
  | "courseworkStudent"
  | "courseworkItem"
  | "courseworkClassroom"
>

/** 並び替えの入力。number が null の行は末尾へ回す */
interface OrderableRow {
  id: string
  order: number | null
  /** 同じ番号が並んだときの決着に使う、人が見ている順の値 */
  tieBreak: string
}

/**
 * いま入っている順を保ったまま 1..n の連番へ詰め直した並びを返す。
 *
 * 「詰め直す必要が無い」（既に 1..n の連番で、順序も変わらない）ときは空を返す。
 * 書かなくてよい行を書かないためで、こうしないと updatedAt が無駄に動く。
 */
export function compactOrder(
  rows: OrderableRow[],
  startAt: number
): Array<{ id: string; order: number }> {
  const sorted = [...rows].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.tieBreak.localeCompare(right.tieBreak)
  })

  const changed: Array<{ id: string; order: number }> = []
  sorted.forEach((row, index) => {
    const order = startAt + index
    if (row.order !== order) changed.push({ id: row.id, order })
  })
  return changed
}

/**
 * 試験の受験者名簿（ExamStudent.customOrder）を詰め直す。
 *
 * 名簿の並びは学籍番号で決着させる（06/07 の一覧が既定でその順に見える）。
 */
export async function reorderExamStudents(
  examId: string,
  tx: ReorderClient
): Promise<void> {
  const examStudents = await tx.examStudent.findMany({
    where: { examId },
    include: { student: true },
  })

  const changed = compactOrder(
    examStudents.map((examStudent) => ({
      id: examStudent.id,
      order: examStudent.customOrder,
      tieBreak: examStudent.student.studentNumber,
    })),
    1
  )

  for (const row of changed) {
    await tx.examStudent.update({
      where: { id: row.id },
      data: { customOrder: row.order },
    })
  }
}

/**
 * 試験の対象学級（ExamClassroom.order）を詰め直す。
 *
 * 学級の並びは学級名で決着させる。0 始まりなのは既存の採番に合わせるため
 * （追加時に `max + 1` ではなく 0 から振っている）。
 */
export async function reorderExamClassrooms(
  examId: string,
  tx: ReorderClient
): Promise<void> {
  const examClassrooms = await tx.examClassroom.findMany({
    where: { examId },
    include: { classroom: true },
  })

  const changed = compactOrder(
    examClassrooms.map((examClassroom) => ({
      id: examClassroom.id,
      order: examClassroom.order,
      tieBreak: examClassroom.classroom.name,
    })),
    0
  )

  for (const row of changed) {
    await tx.examClassroom.update({
      where: { id: row.id },
      data: { order: row.order },
    })
  }
}

/**
 * 小計グループの中の小計（Subtotal.order）を詰め直す。
 *
 * 小計の並びは名前で決着させる（同じ番号に並んだときだけ効く）。
 */
export async function reorderSubtotals(
  subtotalGroupId: string,
  tx: ReorderClient
): Promise<void> {
  const subtotals = await tx.subtotal.findMany({ where: { subtotalGroupId } })

  const changed = compactOrder(
    subtotals.map((subtotal) => ({
      id: subtotal.id,
      order: subtotal.order,
      tieBreak: subtotal.name,
    })),
    0
  )

  for (const row of changed) {
    await tx.subtotal.update({
      where: { id: row.id },
      data: { order: row.order },
    })
  }
}

/**
 * 試験外成績資料の名簿（CourseworkStudent.customOrder）を詰め直す。
 *
 * 名簿の並びは学籍番号で決着させる。1 始まりなのは既存の採番に合わせるため
 * （rosterManager が `max + 1` を 0 から数えて振っている）。
 */
export async function reorderCourseworkStudents(
  courseworkId: string,
  tx: ReorderClient
): Promise<void> {
  const courseworkStudents = await tx.courseworkStudent.findMany({
    where: { courseworkId },
    include: { student: true },
  })

  const changed = compactOrder(
    courseworkStudents.map((courseworkStudent) => ({
      id: courseworkStudent.id,
      order: courseworkStudent.customOrder,
      tieBreak: courseworkStudent.student.studentNumber,
    })),
    1
  )

  for (const row of changed) {
    await tx.courseworkStudent.update({
      where: { id: row.id },
      data: { customOrder: row.order },
    })
  }
}

/** 試験外成績資料の評価項目（CourseworkItem.order）を詰め直す。並びは名前で決着させる */
export async function reorderCourseworkItems(
  courseworkId: string,
  tx: ReorderClient
): Promise<void> {
  const items = await tx.courseworkItem.findMany({ where: { courseworkId } })

  const changed = compactOrder(
    items.map((item) => ({
      id: item.id,
      order: item.order,
      tieBreak: item.name,
    })),
    0
  )

  for (const row of changed) {
    await tx.courseworkItem.update({
      where: { id: row.id },
      data: { order: row.order },
    })
  }
}

/** 試験外成績資料の対象学級（CourseworkClassroom.order）を詰め直す。並びは学級名で決着させる */
export async function reorderCourseworkClassrooms(
  courseworkId: string,
  tx: ReorderClient
): Promise<void> {
  const courseworkClassrooms = await tx.courseworkClassroom.findMany({
    where: { courseworkId },
    include: { classroom: true },
  })

  const changed = compactOrder(
    courseworkClassrooms.map((courseworkClassroom) => ({
      id: courseworkClassroom.id,
      order: courseworkClassroom.order,
      tieBreak: courseworkClassroom.classroom.name,
    })),
    0
  )

  for (const row of changed) {
    await tx.courseworkClassroom.update({
      where: { id: row.id },
      data: { order: row.order },
    })
  }
}
