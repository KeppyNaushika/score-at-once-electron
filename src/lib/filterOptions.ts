import type { FilterOption } from "@/components/common/ListFilterBar"

/**
 * 一覧の行から学級フィルタの選択肢（id 重複排除済み）を集約する。
 *
 * `getClassrooms` は 1 行が属する学級（id・name）を返す。行をまたいで同じ
 * 学級が現れても id で一意化する。
 */
export function collectClassroomOptions<Row>(
  rows: Row[],
  getClassrooms: (row: Row) => { id: string; name: string }[]
): FilterOption[] {
  const nameById = new Map<string, string>()
  for (const row of rows) {
    for (const classroom of getClassrooms(row)) {
      nameById.set(classroom.id, classroom.name)
    }
  }
  return [...nameById.entries()].map(([id, name]) => ({ id, name }))
}
