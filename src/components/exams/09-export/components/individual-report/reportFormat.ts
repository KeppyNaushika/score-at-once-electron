/**
 * 個人成績表の表記（日付・生徒の所属）。
 * プレビュー（React）とPDF出力（renderToStaticMarkup）の両方で使用
 */

/**
 * 日付をフォーマット
 */
export function formatDate(date: Date | null): string {
  if (!date) return ""
  const parsedDate = new Date(date)
  return `${parsedDate.getFullYear()}年${parsedDate.getMonth() + 1}月${parsedDate.getDate()}日`
}

/**
 * 生徒の所属表記（例: 「2年 A組 3番」）を組み立てる。
 * 学級名は先生が自由に付けるため「2年A組」のように学年を含むことがある。そのときに
 * 学年を前に付けると「2年 2年A組」と二重になるので、学級名が同じ学年を含むなら学年を省く。
 * 全角数字（「２年A組」）も同じ学年とみなす。「12年」の中の「2年」は同じ学年とみなさない。
 */
export function formatStudentAffiliation(
  grade: string | null,
  className: string | null,
  attendanceNumber: number | null
): string {
  const classNameIncludesGrade =
    grade !== null &&
    className !== null &&
    new RegExp(`(^|[^0-9])${escapeRegExp(grade)}年`).test(
      className.normalize("NFKC")
    )
  const parts = [
    grade && !classNameIncludesGrade ? `${grade}年` : null,
    className,
    attendanceNumber != null ? `${attendanceNumber}番` : null,
  ]
  return parts.filter((part) => part).join(" ")
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
