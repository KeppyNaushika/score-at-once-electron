import type { Classroom, Student } from "@prisma/client"

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

/**
 * 学級の絞り込みの選択肢。先頭に「すべての学級」（値は `"all"`）を置く。
 *
 * 非表示の学級は名前に「（非表示）」を添える（前年度の学級は非表示にされていることが
 * 多く、過去の所属で絞るときに見分けが要る）。並び順は呼び出し側が決める。
 *
 * @param classrooms - 選べる学級（並べたい順）
 */
export function classroomFilterOptions(classrooms: Classroom[]) {
  return [
    { value: "all", label: "すべての学級" },
    ...classrooms.map((classroom) => ({
      value: classroom.id,
      label:
        classroom.isVisible === false
          ? `${classroom.name}（非表示）`
          : classroom.name,
      keywords: classroomSearchKeywords(classroom),
    })),
  ]
}

/** 生徒の選択肢に要る列 */
type StudentOptionSource = Pick<
  Student,
  "lastName" | "firstName" | "lastNameKana" | "firstNameKana" | "studentNumber"
>

/**
 * 生徒を、絞り込みの欄で打たれそうな手がかりに並べる。
 *
 * 氏名は選択肢の `label` に出るので、ここには載せない。番号と読み（カナ）を、
 * 姓名の間を空けた形と詰めた形の両方で載せる。
 *
 * @param student - 選択肢にする生徒
 * @returns Combobox の選択肢の `keywords` に渡す文字列
 */
function studentSearchKeywords(student: StudentOptionSource): string[] {
  return [
    student.studentNumber,
    `${student.lastNameKana} ${student.firstNameKana}`,
    `${student.lastNameKana}${student.firstNameKana}`,
  ]
}

/**
 * 生徒1人の選択肢。表示は「姓 名 (番号)」にそろえる。
 *
 * @param value - 選んだときに返す値（受験生徒なら examStudentId、生徒なら studentId）
 * @param student - 選択肢にする生徒
 */
export function studentOption(value: string, student: StudentOptionSource) {
  return {
    value,
    label: `${student.lastName} ${student.firstName} (${student.studentNumber})`,
    keywords: studentSearchKeywords(student),
  }
}

/**
 * 一覧の検索欄（`matchesSearchTerm`）で生徒を引く手がかり。氏名・読み（カナ）・番号。
 *
 * @param student - 検索の対象にする生徒
 */
export function studentSearchTerms(student: StudentOptionSource): string[] {
  return [
    `${student.lastName}${student.firstName}`,
    `${student.lastNameKana}${student.firstNameKana}`,
    student.studentNumber,
  ]
}
