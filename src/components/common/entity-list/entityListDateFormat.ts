import type { EntityListDate } from "./types"

/** `yy/mm/dd`。列幅を食わないよう西暦は下2桁 */
export function formatDay(date: EntityListDate): string {
  if (date === null) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"
  return `${String(parsed.getFullYear()).slice(-2)}/${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}`
}

/** その日を指す鍵（`toLocaleDateString` を挟まず、ローカルの年月日で比べる） */
function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * 更新日時の短い姿。今日と昨日は時刻まで、それより前は `yy/mm/dd`。
 *
 * 「今日」は**描いた時点の判定**なので、一覧を開いたまま日付を跨ぐと「今日」のまま
 * 残る。正確な値は tooltip で常に読めるので、そのために時計を持たない。
 */
export function formatUpdatedAt(date: EntityListDate): string {
  if (date === null) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"

  const now = new Date()
  const dayKey = toDayKey(parsed)
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(
    parsed.getMinutes()
  ).padStart(2, "0")}`

  if (dayKey === toDayKey(now)) return `今日 ${time}`
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  )
  if (dayKey === toDayKey(yesterday)) return `昨日 ${time}`
  return formatDay(parsed)
}

/** tooltip に出す `yyyy/mm/dd hh:mm`。省略のない形はここだけ */
export function formatFullDateTime(date: EntityListDate): string | null {
  if (date === null) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(
    2,
    "0"
  )}/${String(parsed.getDate()).padStart(2, "0")} ${String(
    parsed.getHours()
  ).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
}
