/**
 * 朱書き（ルーブリック項目の助言から作る生徒向けの注釈）の文字の折り返し
 * （docs/vlm-grading-design.md §9）
 *
 * 表示幅は全角1・半角0.55、禁則あり、`$` は取り除く。文の中の改行は段落の区切りとして残し、
 * 段落ごとに折り返す（助言を並べるとき）。置き場所の探索は `annotationPlacement.ts`。
 */

/** 半角文字の表示幅（全角を1とした比） */
const HALF_WIDTH_CHARACTER_WIDTH = 0.55

/** 行頭に置かない文字（行頭禁則） */
const LINE_START_PROHIBITED_CHARACTERS = new Set(
  Array.from(
    "。、，．,.:;：；!！?？)）」』】〕〉》］｝]}・ー…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々"
  )
)

/** 行末に置かない文字（行末禁則） */
const LINE_END_PROHIBITED_CHARACTERS = new Set(
  Array.from("「（『【〔〈《［｛([{")
)

function isHalfWidthCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0
  // ASCII の表示文字と半角カナ
  return (
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    (codePoint >= 0xff61 && codePoint <= 0xff9f)
  )
}

function characterDisplayWidth(character: string): number {
  return isHalfWidthCharacter(character) ? HALF_WIDTH_CHARACTER_WIDTH : 1
}

/** 文字の並びの表示幅（全角換算） */
export function lineDisplayWidth(characters: readonly string[]): number {
  return characters.reduce(
    (acc, character) => acc + characterDisplayWidth(character),
    0
  )
}

/** 注釈文から改行と `$`（MathJax の数式区切りとして解釈される）を取り除く */
export function sanitizeAnnotationText(annotationText: string): string {
  return annotationText
    .replace(/[\r\n]+/g, "")
    .replace(/\$/g, "")
    .trim()
}

/**
 * 注釈文を段落に分ける（改行が段落の区切り）。段落ごとに `sanitizeAnnotationText` を通し、
 * 空になった段落は落とす
 */
export function toAnnotationParagraphs(annotationText: string): string[] {
  return annotationText
    .split(/\r?\n/)
    .map(sanitizeAnnotationText)
    .filter((paragraph) => paragraph !== "")
}

/** 段落ごとに折り返し、行を1つの並びにする */
export function wrapAnnotationParagraphs(
  paragraphs: readonly string[],
  charactersPerLine: number
): string[] {
  return paragraphs.flatMap((paragraph) =>
    wrapAnnotationText(paragraph, charactersPerLine)
  )
}

/**
 * 1行の字数（全角換算の表示幅）に収まるよう折り返す。
 *
 * 行に入りきらなくなったところで改行し、禁則に当たるときは改行位置を前へずらして
 * 文字を次の行へ追い出す（行頭禁則の文字の前の1文字、行末禁則の文字そのもの）。
 * 追い出すと行が空になるときは、禁則より字数を優先してそのまま改行する。
 */
export function wrapAnnotationText(
  annotationText: string,
  charactersPerLine: number
): string[] {
  const characters = Array.from(annotationText)
  const lineCapacity = Math.max(1, charactersPerLine)
  const lines: string[] = []

  let lineStart = 0
  while (lineStart < characters.length) {
    // 収まるだけ入れる（最低1文字）
    let lineEnd = lineStart + 1
    while (
      lineEnd < characters.length &&
      lineDisplayWidth(characters.slice(lineStart, lineEnd + 1)) <= lineCapacity
    ) {
      lineEnd += 1
    }

    // 禁則: 改行位置を前へずらす
    let adjustedEnd = lineEnd
    while (
      adjustedEnd < characters.length &&
      adjustedEnd - 1 > lineStart &&
      (LINE_START_PROHIBITED_CHARACTERS.has(characters[adjustedEnd]) ||
        LINE_END_PROHIBITED_CHARACTERS.has(characters[adjustedEnd - 1]))
    ) {
      adjustedEnd -= 1
    }
    const isAdjustmentValid =
      adjustedEnd >= characters.length ||
      (!LINE_START_PROHIBITED_CHARACTERS.has(characters[adjustedEnd]) &&
        !LINE_END_PROHIBITED_CHARACTERS.has(characters[adjustedEnd - 1]))
    const breakAt = isAdjustmentValid ? adjustedEnd : lineEnd

    lines.push(characters.slice(lineStart, breakAt).join(""))
    lineStart = breakAt
  }

  return lines
}
