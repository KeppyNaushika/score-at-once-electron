/**
 * CSV のセルを1つ書く規則（R / exametrika 向けの出力で使う）
 *
 * - 引用符・カンマ・改行（`\n` と `\r`）を含むセルは `"` で囲み、中の `"` は重ねる
 * - 文字列のセルで、先頭が表計算ソフトに数式として読まれうる文字（`=` `+` `-` `@` タブ `\r`）の
 *   ときは `'` を前置して文字列として読ませる。CSV は R だけでなく Excel で開かれることもあるため
 * - 数値、および数値としてそのまま読める文字列（`-3`・`1.5` 等）は前置しない。
 *   R の `read.csv` で数値の列のまま読めるようにするため（数値は数式として働かない）
 *
 * 前置した `'` は R で読むと値の一部になるが、対象は氏名・設問名などの文字列の列で、
 * 先頭が上の文字になるのは稀なので、値が変わるより開いたときに式が走らない方を取る。
 */

/** 表計算ソフトが数式の始まりとして扱う先頭文字 */
const FORMULA_LEADING_CHARACTERS = ["=", "+", "-", "@", "\t", "\r"]

/** 数値としてそのまま読める文字列（符号付きの整数・小数） */
const NUMERIC_TEXT_PATTERN = /^[+-]?\d+(\.\d+)?$/

function neutralizeFormula(text: string): string {
  if (NUMERIC_TEXT_PATTERN.test(text)) return text
  const startsLikeFormula = FORMULA_LEADING_CHARACTERS.some((character) =>
    text.startsWith(character)
  )
  return startsLikeFormula ? `'${text}` : text
}

export function csvCell(cellValue: string | number): string {
  const text =
    typeof cellValue === "number"
      ? String(cellValue)
      : neutralizeFormula(cellValue)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
