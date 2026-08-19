import type {
  CourseworkItemWithLetterScales,
  CourseworkScoreWithCourseworkStudent,
  CourseworkStudentWithMemberships,
} from "@/types/coursework.types"

/**
 * 生徒×評価項目のマス目を組み立てる純粋関数。
 *
 * 取得は呼び出し側（コンポーネント）が行う。ここは並んだ行から表の形を作るだけで、
 * キーもチャンネルも持たない。
 */

/** 1セル分の点数（評価項目×生徒） */
export interface CourseworkCell {
  /** 数値モードのスコア */
  score: number | null
  /** 文字モードの評価記号 */
  letterValue: string | null
  /** 加点・減点 */
  adjustment: number | null
  /** 加減点の理由 */
  adjustmentReason: string | null
  /** コメント（成績通知書に表示） */
  comment: string | null
}

/** 点数の部分更新（変更されたフィールドのみ） */
export type CourseworkCellPatch = Partial<CourseworkCell>

/**
 * 名簿1行（対象者の生徒情報 + 評価項目ごとのセル値）
 *
 * 行の同定は資料の対象者（CourseworkStudent）の id で行う。点数の書き込み先が
 * 対象者だからで、人（Student）の id では名簿に載っていない生徒にも書けてしまう。
 */
interface CourseworkStudentRow {
  courseworkStudentId: string
  studentNumber: string
  lastName: string
  firstName: string
  attendanceNumber: number | null
  className: string | null
  /** courseworkItemId -> セル値 */
  cells: Record<string, CourseworkCell>
}

const EMPTY_CELL: CourseworkCell = {
  score: null,
  letterValue: null,
  adjustment: null,
  adjustmentReason: null,
  comment: null,
}

/**
 * 評価項目の点数の中から、その対象者の1件を取り出す。
 *
 * 引数に対象者の実体を要求することで、呼び出し側が生徒 id（Student.id）を
 * 渡してしまう取り違えを型で弾く（どちらも string で見分けがつかないため）。
 */
function findScoreOf(
  scores: CourseworkScoreWithCourseworkStudent[] | undefined,
  courseworkStudent: CourseworkStudentWithMemberships
): CourseworkScoreWithCourseworkStudent | undefined {
  return scores?.find(
    (score) => score.courseworkStudentId === courseworkStudent.id
  )
}

/** 評価項目を order 昇順に並べる */
export function sortCourseworkItems(
  items: CourseworkItemWithLetterScales[]
): CourseworkItemWithLetterScales[] {
  return items.slice().sort((itemA, itemB) => itemA.order - itemB.order)
}

/**
 * 名簿の行を組み立てる。
 *
 * @param scoresByItem 評価項目 id → その項目の点数の行
 */
export function buildCourseworkStudentRows(
  items: CourseworkItemWithLetterScales[],
  courseworkStudents: CourseworkStudentWithMemberships[],
  registeredClassroomIds: ReadonlySet<string>,
  scoresByItem: ReadonlyMap<string, CourseworkScoreWithCourseworkStudent[]>
): CourseworkStudentRow[] {
  return courseworkStudents.map((courseworkStudent) => {
    const cells: Record<string, CourseworkCell> = {}
    for (const item of items) {
      const score = findScoreOf(scoresByItem.get(item.id), courseworkStudent)
      cells[item.id] = score
        ? {
            score: score.score ?? null,
            letterValue: score.letterValue ?? null,
            adjustment: score.adjustment ?? null,
            adjustmentReason: score.adjustmentReason ?? null,
            comment: score.comment ?? null,
          }
        : { ...EMPTY_CELL }
    }
    const membership = courseworkStudent.student.memberships.find(
      (membership) => registeredClassroomIds.has(membership.classroomId)
    )
    return {
      courseworkStudentId: courseworkStudent.id,
      studentNumber: courseworkStudent.student.studentNumber,
      lastName: courseworkStudent.student.lastName,
      firstName: courseworkStudent.student.firstName,
      attendanceNumber: membership?.attendanceNumber ?? null,
      className: membership?.classroom.name ?? null,
      cells,
    }
  })
}
