/**
 * 取り込みの照合で、生徒・学級・小計グループ・利用者の行を見分けるための呼び名と添え書き。
 *
 * 統合アーカイブ（.sao）と旧形式の取り込みの両方の照合画面で使う。行は加工しない生の形
 * （Prisma の include の出力、または SQLite の行）で受け取り、ここで見せる言葉を作る。
 * 同じ番号・同じ名前の行が並ぶのは正常なので（id で区別する）、添え書きに見分ける材料を載せる:
 * - 生徒: 読み・入学年度・所属学級（`memberships[].classroom` があれば）
 * - 学級: コード・学年・説明・人数（`memberships` があれば）・作成日
 * - 小計グループ: 小計項目（`subtotals` があれば）・使っている試験（`examSubtotalGroups[].exam` があれば）・作成日
 */

/** 生の行の1列を文字にする（文字でも数でもなければ空） */
export function rowText(
  row: Readonly<Record<string, unknown>>,
  column: string
): string {
  const columnValue = row[column]
  if (typeof columnValue === "string") return columnValue
  if (typeof columnValue === "number" || typeof columnValue === "bigint") {
    return String(columnValue)
  }
  return ""
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !(value instanceof Date)

/** 行の1列の配列のうち、行の形のものだけ（無ければ undefined） */
const rowList = (
  row: Readonly<Record<string, unknown>>,
  column: string
): Record<string, unknown>[] | undefined => {
  const columnValue = row[column]
  return Array.isArray(columnValue) ? columnValue.filter(isRecord) : undefined
}

/** 作成日（日付だけ。読めなければ空） */
const createdDayText = (row: Readonly<Record<string, unknown>>): string => {
  const createdAt = row.createdAt
  const parsed =
    createdAt instanceof Date
      ? createdAt
      : typeof createdAt === "string" || typeof createdAt === "number"
        ? new Date(createdAt)
        : null
  return parsed && !Number.isNaN(parsed.getTime())
    ? `作成 ${parsed.toLocaleDateString("ja-JP")}`
    : ""
}

/** 生徒の所属学級の名前（在籍中を先に。所属の行が無ければ空） */
const studentClassroomNames = (
  row: Readonly<Record<string, unknown>>
): string[] => {
  const memberships = rowList(row, "memberships") ?? []
  const current = memberships.filter((membership) => !membership.endDate)
  const shown = current.length > 0 ? current : memberships
  return [
    ...new Set(
      shown.flatMap((membership) =>
        isRecord(membership.classroom)
          ? [rowText(membership.classroom, "name")]
          : []
      )
    ),
  ].filter((name) => name !== "")
}

/** 照合の表（生徒・学級・小計グループ・利用者）の行の呼び名 */
export function matchRowLabel(
  table: string,
  row: Readonly<Record<string, unknown>>
): string {
  switch (table) {
    case "Student": {
      const fullName = `${rowText(row, "lastName")} ${rowText(row, "firstName")}`
      const studentNumber = rowText(row, "studentNumber")
      return studentNumber ? `${fullName} (${studentNumber})` : fullName
    }
    case "User": {
      const name = rowText(row, "name")
      const username = rowText(row, "username")
      return name === username || !username ? name : `${name}（${username}）`
    }
    default:
      return rowText(row, "name")
  }
}

/** 同じ名前・番号の候補を見分けるための添え書き */
export function matchRowDetail(
  table: string,
  row: Readonly<Record<string, unknown>>
): string {
  const parts = (() => {
    switch (table) {
      case "Student": {
        const enrollmentYear = rowText(row, "enrollmentYear")
        const classroomNames = studentClassroomNames(row)
        return [
          `${rowText(row, "lastNameKana")} ${rowText(row, "firstNameKana")}`.trim(),
          enrollmentYear ? `${enrollmentYear}年度入学` : "",
          classroomNames.length > 0 ? classroomNames.join("・") : "",
        ]
      }
      case "Classroom": {
        const grade = rowText(row, "grade")
        const memberships = rowList(row, "memberships")
        return [
          rowText(row, "classroomCode"),
          grade ? `${grade}年` : "",
          rowText(row, "description"),
          memberships ? `${memberships.length}名` : "",
          createdDayText(row),
        ]
      }
      case "SubtotalGroup": {
        const subtotalNames = (rowList(row, "subtotals") ?? []).map(
          (subtotal) => rowText(subtotal, "name")
        )
        const examNames = (rowList(row, "examSubtotalGroups") ?? []).flatMap(
          (examSubtotalGroup) =>
            isRecord(examSubtotalGroup.exam)
              ? [rowText(examSubtotalGroup.exam, "examName")]
              : []
        )
        return [
          subtotalNames.length > 0 ? `小計 ${subtotalNames.join("・")}` : "",
          examNames.length > 0 ? `使用 ${examNames.join("・")}` : "",
          createdDayText(row),
        ]
      }
      default:
        return []
    }
  })()
  return parts.filter((part) => part !== "").join("・")
}

/** 照合の候補を選ぶ Combobox の絞り込み語（表示はしないが打てば引っかかる） */
export function matchRowKeywords(
  table: string,
  row: Readonly<Record<string, unknown>>
): string[] {
  switch (table) {
    case "Student":
      return [
        rowText(row, "studentNumber"),
        `${rowText(row, "lastNameKana")} ${rowText(row, "firstNameKana")}`,
        `${rowText(row, "lastNameKana")}${rowText(row, "firstNameKana")}`,
        ...studentClassroomNames(row),
      ]
    case "Classroom":
      return [rowText(row, "classroomCode"), rowText(row, "description")]
    case "SubtotalGroup":
      return (rowList(row, "subtotals") ?? []).map((subtotal) =>
        rowText(subtotal, "name")
      )
    case "User":
      return [rowText(row, "username")]
    default:
      return []
  }
}
