/**
 * AI採点の注釈（生徒向けの朱書き）を、解答欄の中で手書きに重ならない位置へ置く
 *
 * renderer で計算する純粋関数。占有グリッド（`AnswerInkGrid`）は main が答案画像から作る。
 *
 * 1. 注釈文を折り返す（表示幅は全角1・半角0.55、禁則あり、`$` は取り除く）
 * 2. 解答欄の内幅の 100・85・70・55・40% で折り返した箱を候補にする
 * 3. 占有グリッドを1セル膨らませ、累積和の表で各候補を全位置について O(1) で判定する
 * 4. 置ける位置のうち、いちばん下 → 左寄り → 行数の少ないもの を選ぶ
 *    （書き終わりの下に置く。横方向の空きも使う）
 * 5. 収まらなければ文字を小さくして（`MINIMUM_FONT_SIZE_MM` まで 0.5mm 刻み）1〜4 をやり直す。
 *    収まる中でいちばん大きい文字を採る
 * 6. 最小の文字でも収まらなければ、枠の中に入る箱のうち重なるインクが最少の位置に置き
 *    `overlapsInk: true` を返す。枠に入る箱すら無ければ（注釈文が長すぎる）、最小の文字・
 *    全幅で折り返して枠の左上に置き、`exceedsRegion: true` を返す。
 *    枠の外へのはみ出しは「重なり」より悪いものとして扱う（はみ出した分は他の設問に掛かる）
 *
 * 描画側（`textConversionUtils.ts` の convertTextToSvg）は自分では折り返さず、
 * `\n` で行に分け、1行ごとの高さ＋固定 5px の間隔で縦に並べる。そのためここで改行を入れる。
 */

import type { AnswerInkGrid } from "./answerInkGrid"

/**
 * 行送り（fontSize に対する倍率）。試行の実測値。
 * 実際の描画は「1行の高さ＋固定 5px」で用紙の大きさにより比が変わるので、
 * 描画結果と照らして校正する（定数はこの1つだけにしておく）
 */
export const LINE_PITCH_RATIO = 1.4

/** 文字を縮めるときの下限（mm）。これより小さいと印刷して読めない */
export const MINIMUM_FONT_SIZE_MM = 2.5

/** 文字を縮める刻み（mm） */
const FONT_SIZE_STEP_MM = 0.5

/** 半角文字の表示幅（全角を1とした比） */
const HALF_WIDTH_CHARACTER_WIDTH = 0.55

/** 折り返しの候補にする、内幅に対する割合 */
const WRAP_WIDTH_RATIOS = [1, 0.85, 0.7, 0.55, 0.4]

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

/** 用紙の寸法（mm、画像の左右・上下に合わせた向き） */
interface PaperDimensionsMm {
  width: number
  height: number
}

interface AnnotationPlacementInput {
  /** 注釈文（改行なし。含まれていても取り除く） */
  annotationText: string
  /** 文字の大きさ（mm）。収まらなければ `MINIMUM_FONT_SIZE_MM` まで縮める */
  fontSizeMm: number
  /** 用紙の寸法（mm）。`getOrientedPaperDimensions` で向きを合わせたもの */
  paperDimensions: PaperDimensionsMm
  /** 解答欄の内側の占有グリッド。置き場所の範囲はこのグリッドの範囲 */
  inkGrid: AnswerInkGrid
}

/** 注釈の置き場所（anchorDirection は "top-left"） */
export interface AnnotationPlacement {
  /** 左上の x（用紙比） */
  x: number
  /** 左上の y（用紙比） */
  y: number
  /** `\n` で改行した注釈文 */
  text: string
  /** 文字の大きさ（mm） */
  fontSize: number
  lineCount: number
  /** どこにも収まらず、手書きに重ねて置いた */
  overlapsInk: boolean
  /** 最小の文字でも枠に入りきらず、枠の外へはみ出す（注釈文を短くする必要がある） */
  exceedsRegion: boolean
}

/** 折り返した注釈文の箱の候補 */
interface WrappedCandidate {
  lines: string[]
  /** 箱の幅・高さ（セル数） */
  columnSpan: number
  rowSpan: number
}

/** 候補を置く位置 */
interface CandidatePosition {
  candidate: WrappedCandidate
  column: number
  row: number
  overlappedCellCount: number
}

/**
 * 浮動小数の誤差を無視した切り上げ・切り捨て。mm と用紙比の行き来で、整数のはずの値が
 * 28.000000000000004 や 15.999999999999998 になっても、28・16 として扱う
 */
const ROUNDING_TOLERANCE = 1e-9

function ceilIgnoringRoundingError(value: number): number {
  return Math.ceil(value - ROUNDING_TOLERANCE)
}

function floorIgnoringRoundingError(value: number): number {
  return Math.floor(value + ROUNDING_TOLERANCE)
}

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

function lineDisplayWidth(characters: readonly string[]): number {
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

/**
 * 占有グリッドを1セル膨らませ（8近傍）、累積和の表を作る。
 * 表は (rowCount + 1) × (columnCount + 1) の行優先で、[r][c] は r 行・c 列より手前の合計。
 */
function buildDilatedSummedAreaTable(inkGrid: AnswerInkGrid): number[] {
  const tableWidth = inkGrid.columnCount + 1
  const summedAreaTable = new Array<number>(
    (inkGrid.rowCount + 1) * tableWidth
  ).fill(0)
  const neighborOffsets = [-1, 0, 1]

  for (let row = 0; row < inkGrid.rowCount; row += 1) {
    for (let column = 0; column < inkGrid.columnCount; column += 1) {
      const isOccupiedAfterDilation = neighborOffsets.some((dy) =>
        neighborOffsets.some((dx) => {
          const neighborColumn = column + dx
          const neighborRow = row + dy
          // グリッドの外は膨らませる元にしない（枠の外はインクではない）
          if (
            neighborColumn < 0 ||
            neighborRow < 0 ||
            neighborColumn >= inkGrid.columnCount ||
            neighborRow >= inkGrid.rowCount
          ) {
            return false
          }
          return inkGrid.occupiedCells[
            neighborRow * inkGrid.columnCount + neighborColumn
          ]
        })
      )
      summedAreaTable[(row + 1) * tableWidth + (column + 1)] =
        (isOccupiedAfterDilation ? 1 : 0) +
        summedAreaTable[row * tableWidth + (column + 1)] +
        summedAreaTable[(row + 1) * tableWidth + column] -
        summedAreaTable[row * tableWidth + column]
    }
  }

  return summedAreaTable
}

/** 累積和の表から、左上 (column, row)・大きさ (columnSpan, rowSpan) の占有セル数を求める */
function countOccupiedCells(
  summedAreaTable: readonly number[],
  tableWidth: number,
  column: number,
  row: number,
  columnSpan: number,
  rowSpan: number
): number {
  const right = column + columnSpan
  const bottom = row + rowSpan
  return (
    summedAreaTable[bottom * tableWidth + right] -
    summedAreaTable[row * tableWidth + right] -
    summedAreaTable[bottom * tableWidth + column] +
    summedAreaTable[row * tableWidth + column]
  )
}

/** 内幅の各割合で折り返した候補を作る。同じ折り返しになるものは1つにまとめる */
function buildWrappedCandidates(
  text: string,
  fontSizeMm: number,
  paperDimensions: PaperDimensionsMm,
  inkGrid: AnswerInkGrid
): WrappedCandidate[] {
  const innerWidthMm =
    inkGrid.columnCount * inkGrid.cellWidth * paperDimensions.width
  const cellWidthMm = inkGrid.cellWidth * paperDimensions.width
  const cellHeightMm = inkGrid.cellHeight * paperDimensions.height
  const linePitchMm = fontSizeMm * LINE_PITCH_RATIO

  const candidatesByText = new Map<string, WrappedCandidate>()
  WRAP_WIDTH_RATIOS.forEach((widthRatio) => {
    const charactersPerLine = floorIgnoringRoundingError(
      (innerWidthMm * widthRatio) / fontSizeMm
    )
    const lines = wrapAnnotationText(text, charactersPerLine)
    const wrappedText = lines.join("\n")
    if (candidatesByText.has(wrappedText)) return

    const boxWidthMm =
      Math.max(...lines.map((line) => lineDisplayWidth(Array.from(line)))) *
      fontSizeMm
    const boxHeightMm = lines.length * linePitchMm
    candidatesByText.set(wrappedText, {
      lines,
      columnSpan: Math.max(
        1,
        ceilIgnoringRoundingError(boxWidthMm / cellWidthMm)
      ),
      rowSpan: Math.max(
        1,
        ceilIgnoringRoundingError(boxHeightMm / cellHeightMm)
      ),
    })
  })

  return [...candidatesByText.values()]
}

/** a の方が良い位置なら負を返す（いちばん下 → 左寄り → 行数の少ないもの） */
function comparePositions(
  positionA: CandidatePosition,
  positionB: CandidatePosition
): number {
  return (
    positionB.row - positionA.row ||
    positionA.column - positionB.column ||
    positionA.candidate.lines.length - positionB.candidate.lines.length
  )
}

/** 大きい順に試す文字の大きさ（mm）。指定が下限より小さければ指定の大きさだけ */
function listFontSizesToTry(preferredFontSizeMm: number): number[] {
  if (preferredFontSizeMm <= MINIMUM_FONT_SIZE_MM) return [preferredFontSizeMm]
  const stepCount = Math.floor(
    (preferredFontSizeMm - MINIMUM_FONT_SIZE_MM) / FONT_SIZE_STEP_MM +
      ROUNDING_TOLERANCE
  )
  const fontSizes = Array.from(
    { length: stepCount + 1 },
    (_, stepIndex) => preferredFontSizeMm - stepIndex * FONT_SIZE_STEP_MM
  )
  return fontSizes.at(-1) === MINIMUM_FONT_SIZE_MM
    ? fontSizes
    : [...fontSizes, MINIMUM_FONT_SIZE_MM]
}

/** ある文字の大きさで、手書きに重ならず枠に収まる最良の位置。無ければ null */
function findBestFittingPosition(
  candidates: readonly WrappedCandidate[],
  inkGrid: AnswerInkGrid,
  summedAreaTable: readonly number[]
): CandidatePosition | null {
  const tableWidth = inkGrid.columnCount + 1
  let bestFittingPosition: CandidatePosition | null = null
  candidates.forEach((candidate) => {
    for (let row = 0; row + candidate.rowSpan <= inkGrid.rowCount; row += 1) {
      for (
        let column = 0;
        column + candidate.columnSpan <= inkGrid.columnCount;
        column += 1
      ) {
        const overlappedCellCount = countOccupiedCells(
          summedAreaTable,
          tableWidth,
          column,
          row,
          candidate.columnSpan,
          candidate.rowSpan
        )
        if (overlappedCellCount !== 0) continue
        const position = { candidate, column, row, overlappedCellCount }
        if (
          !bestFittingPosition ||
          comparePositions(position, bestFittingPosition) < 0
        ) {
          bestFittingPosition = position
        }
      }
    }
  })
  return bestFittingPosition
}

/** 枠の中に入る箱のうち、重なるインクが最少の位置。枠に入る箱が無ければ null */
function findLeastOverlappingPosition(
  candidates: readonly WrappedCandidate[],
  inkGrid: AnswerInkGrid,
  summedAreaTable: readonly number[]
): CandidatePosition | null {
  const tableWidth = inkGrid.columnCount + 1
  let leastOverlappingPosition: CandidatePosition | null = null
  candidates.forEach((candidate) => {
    for (let row = 0; row + candidate.rowSpan <= inkGrid.rowCount; row += 1) {
      for (
        let column = 0;
        column + candidate.columnSpan <= inkGrid.columnCount;
        column += 1
      ) {
        const position = {
          candidate,
          column,
          row,
          overlappedCellCount: countOccupiedCells(
            summedAreaTable,
            tableWidth,
            column,
            row,
            candidate.columnSpan,
            candidate.rowSpan
          ),
        }
        if (
          !leastOverlappingPosition ||
          position.overlappedCellCount <
            leastOverlappingPosition.overlappedCellCount ||
          (position.overlappedCellCount ===
            leastOverlappingPosition.overlappedCellCount &&
            comparePositions(position, leastOverlappingPosition) < 0)
        ) {
          leastOverlappingPosition = position
        }
      }
    }
  })
  return leastOverlappingPosition
}

function toPlacement(
  position: CandidatePosition,
  inkGrid: AnswerInkGrid,
  fontSizeMm: number,
  flags: { overlapsInk: boolean; exceedsRegion: boolean }
): AnnotationPlacement {
  return {
    x: inkGrid.originX + position.column * inkGrid.cellWidth,
    y: inkGrid.originY + position.row * inkGrid.cellHeight,
    text: position.candidate.lines.join("\n"),
    fontSize: fontSizeMm,
    lineCount: position.candidate.lines.length,
    ...flags,
  }
}

/**
 * 注釈を置く位置・文字の大きさと、改行を入れた注釈文を決める。
 * 注釈文が空（`$` と改行を除いて何も残らない）なら null。
 */
export function placeAnnotation(
  input: AnnotationPlacementInput
): AnnotationPlacement | null {
  const { paperDimensions, inkGrid } = input
  const text = sanitizeAnnotationText(input.annotationText)
  if (text === "") return null

  const summedAreaTable = buildDilatedSummedAreaTable(inkGrid)
  const fontSizes = listFontSizesToTry(input.fontSizeMm)

  for (const fontSizeMm of fontSizes) {
    const candidates = buildWrappedCandidates(
      text,
      fontSizeMm,
      paperDimensions,
      inkGrid
    )
    const fittingPosition = findBestFittingPosition(
      candidates,
      inkGrid,
      summedAreaTable
    )
    if (fittingPosition) {
      return toPlacement(fittingPosition, inkGrid, fontSizeMm, {
        overlapsInk: false,
        exceedsRegion: false,
      })
    }
  }

  // 最小の文字でも空きに収まらない。枠に入る箱のうち重なり最少の位置に置く
  const smallestFontSizeMm = fontSizes[fontSizes.length - 1]
  const smallestCandidates = buildWrappedCandidates(
    text,
    smallestFontSizeMm,
    paperDimensions,
    inkGrid
  )
  const leastOverlappingPosition = findLeastOverlappingPosition(
    smallestCandidates,
    inkGrid,
    summedAreaTable
  )
  if (leastOverlappingPosition) {
    return toPlacement(leastOverlappingPosition, inkGrid, smallestFontSizeMm, {
      overlapsInk: true,
      exceedsRegion: false,
    })
  }

  // 枠に入る箱すら無い（注釈文が長すぎる）。全幅で折り返した箱を枠の左上に置く
  return toPlacement(
    {
      candidate: smallestCandidates[0],
      column: 0,
      row: 0,
      overlappedCellCount: 0,
    },
    inkGrid,
    smallestFontSizeMm,
    { overlapsInk: true, exceedsRegion: true }
  )
}

/** 字数の目安を出すときに想定する文字の大きさ（mm） */
const CHARACTER_LIMIT_FONT_SIZE_MM = 4

/**
 * 解答欄の面積のうち、朱書きに使えるとみなす割合。手書きが占める分と、箱が長方形で
 * 隙間に詰められない分を見込む
 */
const ANNOTATION_USABLE_AREA_RATIO = 0.35

/** 字数の目安の下限・上限（全角） */
const ANNOTATION_CHARACTER_LIMIT_RANGE = { minimum: 10, maximum: 80 } as const

/**
 * 解答欄の大きさから、朱書きの字数の目安（全角）を出す。VLM に「◯字以内」と伝えるのに使う。
 *
 * 面積（mm²）から求めるので、用紙の向きによらない（縦横を入れ替えても面積は同じ）。
 */
export function estimateAnnotationCharacterLimit(
  regionWidthMm: number,
  regionHeightMm: number
): number {
  const characterArea =
    CHARACTER_LIMIT_FONT_SIZE_MM *
    CHARACTER_LIMIT_FONT_SIZE_MM *
    LINE_PITCH_RATIO
  const estimated = Math.floor(
    (regionWidthMm * regionHeightMm * ANNOTATION_USABLE_AREA_RATIO) /
      characterArea
  )
  return Math.min(
    ANNOTATION_CHARACTER_LIMIT_RANGE.maximum,
    Math.max(ANNOTATION_CHARACTER_LIMIT_RANGE.minimum, estimated)
  )
}
