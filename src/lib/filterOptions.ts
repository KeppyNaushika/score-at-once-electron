import type { Classroom } from "@prisma/client"

/**
 * 一覧の行から学級フィルタの選択肢（id 重複排除済み）を集約する。
 *
 * `getClassrooms` は 1 行が属する学級（Classroom の行）を返す。行をまたいで同じ
 * 学級が現れても id で一意化する。返すのは学級の行そのもので、フィルタ側は
 * id で照合し、名前は表示時に読む（`{ id, name }` へ写し替えない）。
 */
export function collectClassroomOptions<Row>(
  rows: Row[],
  getClassrooms: (row: Row) => Classroom[]
): Classroom[] {
  const classroomById = new Map<string, Classroom>()
  for (const row of rows) {
    for (const classroom of getClassrooms(row)) {
      classroomById.set(classroom.id, classroom)
    }
  }
  return [...classroomById.values()]
}
