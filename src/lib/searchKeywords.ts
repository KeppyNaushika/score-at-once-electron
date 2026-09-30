import type { Classroom } from "@prisma/client"

/**
 * 日付を、絞り込みの欄で打たれそうな書き方に並べる。
 *
 * `2026/09/30`・`2026/9/30`・`2026-09-30` の3つ。ゼロ埋めしない形を入れておくと、
 * `9/30` と打っても引っかかる。日付が無いか読めないときは空。
 *
 * @param date - 試験日・実施日などの基準日
 * @returns Combobox の選択肢の `keywords` に足す文字列
 */
export function dateSearchKeywords(
  date: Date | string | null | undefined
): string[] {
  if (!date) return []
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return []
  const year = parsedDate.getFullYear()
  const month = parsedDate.getMonth() + 1
  const day = parsedDate.getDate()
  const paddedMonth = String(month).padStart(2, "0")
  const paddedDay = String(day).padStart(2, "0")
  return [
    `${year}/${paddedMonth}/${paddedDay}`,
    `${year}/${month}/${day}`,
    `${year}-${paddedMonth}-${paddedDay}`,
  ]
}

/**
 * 学級を、絞り込みの欄で打たれそうな手がかりに並べる。
 *
 * 学級名は選択肢の `label` に出るので、ここには載せない。学級コードと学年
 * （`2年` の形。学年だけ打っても `2` でも引っかかる）と説明を載せる。年度は学級の
 * 列に無いので、名前か説明に書かれていればそこから引っかかる。
 *
 * @param classroom - 選択肢にする学級
 * @returns Combobox の選択肢の `keywords` に渡す文字列
 */
export function classroomSearchKeywords(classroom: Classroom): string[] {
  return [
    classroom.classroomCode,
    classroom.grade === null ? null : `${classroom.grade}年`,
    classroom.description,
  ].filter((keyword) => keyword !== null)
}
