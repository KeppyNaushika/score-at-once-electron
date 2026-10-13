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
 * 同じ見出しの選択肢が並ぶときだけ、見分ける添え書きを見出しに足す。
 *
 * 同じ番号・同じ名前の生徒や学級が並ぶのは正常（id で区別する）なので、見出しが重なった
 * 選択肢にだけ添える（重ならない選択肢の見出しは変えない）。
 *
 * @param options - 選択肢（並べたい順）
 * @param detailOf - その選択肢を見分ける添え書き（無ければ空）
 */
export function withDuplicateLabelDetails<Option extends { label: string }>(
  options: readonly Option[],
  detailOf: (option: Option) => string
): Option[] {
  const labelCounts = new Map<string, number>()
  for (const option of options) {
    labelCounts.set(option.label, (labelCounts.get(option.label) ?? 0) + 1)
  }
  return options.map((option) => {
    if ((labelCounts.get(option.label) ?? 0) < 2) return option
    const detail = detailOf(option)
    return detail
      ? { ...option, label: `${option.label}（${detail}）` }
      : option
  })
}

/** 同じ名前の学級を見分ける添え書き（コード・学年・作成日） */
function classroomDetail(classroom: Classroom): string {
  return [
    classroom.classroomCode,
    classroom.grade === null ? null : `${classroom.grade}年`,
    `作成 ${classroom.createdAt.toLocaleDateString("ja-JP")}`,
  ]
    .filter((part) => part)
    .join("・")
}

/**
 * 学級の選択肢。見出しは学級名で、非表示の学級は「（非表示）」を添える（前年度の学級は
 * 非表示にされていることが多く、過去の所属で絞るときに見分けが要る）。同じ見出しの学級が
 * 並ぶときは、コード・学年・作成日を添える。並び順は呼び出し側が決める。
 *
 * @param classrooms - 選べる学級（並べたい順）
 */
export function classroomOptions(classrooms: readonly Classroom[]) {
  const classroomById = new Map(
    classrooms.map((classroom) => [classroom.id, classroom])
  )
  return withDuplicateLabelDetails(
    classrooms.map((classroom) => ({
      value: classroom.id,
      label:
        classroom.isVisible === false
          ? `${classroom.name}（非表示）`
          : classroom.name,
      keywords: classroomSearchKeywords(classroom),
    })),
    (option) => {
      const classroom = classroomById.get(option.value)
      return classroom ? classroomDetail(classroom) : ""
    }
  )
}

/**
 * 学級の絞り込みの選択肢。先頭に「すべての学級」（値は `"all"`）を置く。
 *
 * @param classrooms - 選べる学級（並べたい順）
 */
export function classroomFilterOptions(classrooms: readonly Classroom[]) {
  return [
    { value: "all", label: "すべての学級" },
    ...classroomOptions(classrooms),
  ]
}

/** 生徒の選択肢に要る列（入学年度は、同じ見出しの生徒を見分ける添え書きに使う） */
type StudentOptionSource = Pick<
  Student,
  "lastName" | "firstName" | "lastNameKana" | "firstNameKana" | "studentNumber"
> &
  Partial<Pick<Student, "enrollmentYear">>

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

/** 同じ番号・氏名の生徒を見分ける添え書き（読み・入学年度） */
function studentDetail(student: StudentOptionSource): string {
  return [
    `${student.lastNameKana} ${student.firstNameKana}`.trim(),
    student.enrollmentYear == null ? null : `${student.enrollmentYear}年度入学`,
  ]
    .filter((part) => part)
    .join("・")
}

/**
 * 生徒の選択肢の一覧。見出しは「姓 名 (番号)」で、同じ見出しの生徒が並ぶときは
 * 読み・入学年度を添える。
 *
 * @param entries - 選んだときに返す値と生徒（並べたい順）
 */
export function studentOptions(
  entries: readonly { value: string; student: StudentOptionSource }[]
) {
  const studentByValue = new Map(
    entries.map((entry) => [entry.value, entry.student])
  )
  return withDuplicateLabelDetails(
    entries.map((entry) => studentOption(entry.value, entry.student)),
    (option) => {
      const student = studentByValue.get(option.value)
      return student ? studentDetail(student) : ""
    }
  )
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
