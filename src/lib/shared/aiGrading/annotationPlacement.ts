/**
 * 朱書き（ルーブリック項目の助言から作る生徒向けの注釈）を、解答欄の中で手書きに重ならない
 * 位置へ置く（docs/vlm-grading-design.md §9）
 *
 * renderer で計算する純粋関数。占有グリッド（`AnswerInkGrid`）は main が答案画像から作る。
 *
 * 1. 注釈文を折り返す（`annotationTextWrap.ts`。表示幅は全角1・半角0.55、禁則あり、`$` は取り除く）。
 *    文の中の改行は段落の区切りとして残し、段落ごとに折り返す（助言を並べるとき）
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
 * 答案のほかの文字の注釈は、手書きと同じく埋まっている場所として扱う（`withOccupiedRectangles` で
 * グリッドに重ねてから 3〜6 を行う。ほかの注釈は動かさない）。
 *
 * 描画側（`textConversionUtils.ts` の convertTextToSvg）は自分では折り返さず、
 * `\n` で行に分け、1行ごとの高さ＋固定 5px の間隔で縦に並べる。そのためここで改行を入れる。
 */

import {
  lineDisplayWidth,
  toAnnotationParagraphs,
  wrapAnnotationParagraphs,
} from "./annotationTextWrap"
import type { AnswerInkGrid } from "./answerInkGrid"

/**
 * 行送り（fontSize に対する倍率）。試行の実測値。
 * 実際の描画は「1行の高さ＋固定 5px」で用紙の大きさにより比が変わるので、
 * 描画結果と照らして校正する（定数はこの1つだけにしておく）
 */
const LINE_PITCH_RATIO = 1.4

/** 文字を縮めるときの下限（mm）。これより小さいと印刷して読めない */
export const MINIMUM_FONT_SIZE_MM = 2.5

/** 文字を縮める刻み（mm） */
const FONT_SIZE_STEP_MM = 0.5

/** 折り返しの候補にする、内幅に対する割合 */
const WRAP_WIDTH_RATIOS = [1, 0.85, 0.7, 0.55, 0.4]

/** 用紙の寸法（mm、画像の左右・上下に合わせた向き） */
interface PaperDimensionsMm {
  width: number
  height: number
}

interface AnnotationPlacementInput {
  /** 注釈文。改行は段落の区切り（段落ごとに折り返す） */
  annotationText: string
  /** 文字の大きさ（mm）。収まらなければ `MINIMUM_FONT_SIZE_MM` まで縮める */
  fontSizeMm: number
  /** 用紙の寸法（mm）。`getOrientedPaperDimensions` で向きを合わせたもの */
  paperDimensions: PaperDimensionsMm
  /** 解答欄の内側の占有グリッド。置き場所の範囲はこのグリッドの範囲 */
  inkGrid: AnswerInkGrid
}

/** 注釈の置き場所（anchorDirection は "top-left"） */
interface AnnotationPlacement {
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

/**
 * 膨らませた累積和の表を、グリッドごとに1回だけ作る（同じグリッドで文だけを変えて何度も置き直す
 * 下見のため。グリッドは main から届いたまま書き換えないので、行の参照で覚えてよい）
 */
const summedAreaTableByInkGrid = new WeakMap<AnswerInkGrid, number[]>()

function dilatedSummedAreaTableOf(inkGrid: AnswerInkGrid): number[] {
  const cached = summedAreaTableByInkGrid.get(inkGrid)
  if (cached) return cached
  const summedAreaTable = buildDilatedSummedAreaTable(inkGrid)
  summedAreaTableByInkGrid.set(inkGrid, summedAreaTable)
  return summedAreaTable
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

/** 折り返した行の箱の大きさ（セル数） */
function boxOfLines(
  lines: string[],
  fontSizeMm: number,
  paperDimensions: PaperDimensionsMm,
  inkGrid: AnswerInkGrid
): WrappedCandidate {
  const cellWidthMm = inkGrid.cellWidth * paperDimensions.width
  const cellHeightMm = inkGrid.cellHeight * paperDimensions.height
  const boxWidthMm =
    Math.max(0, ...lines.map((line) => lineDisplayWidth(Array.from(line)))) *
    fontSizeMm
  const boxHeightMm = lines.length * fontSizeMm * LINE_PITCH_RATIO
  return {
    lines,
    columnSpan: Math.max(
      1,
      ceilIgnoringRoundingError(boxWidthMm / cellWidthMm)
    ),
    rowSpan: Math.max(1, ceilIgnoringRoundingError(boxHeightMm / cellHeightMm)),
  }
}

/** 内幅の各割合で折り返した候補を作る。同じ折り返しになるものは1つにまとめる */
function buildWrappedCandidates(
  paragraphs: readonly string[],
  fontSizeMm: number,
  paperDimensions: PaperDimensionsMm,
  inkGrid: AnswerInkGrid
): WrappedCandidate[] {
  const innerWidthMm =
    inkGrid.columnCount * inkGrid.cellWidth * paperDimensions.width

  const candidatesByText = new Map<string, WrappedCandidate>()
  WRAP_WIDTH_RATIOS.forEach((widthRatio) => {
    const charactersPerLine = floorIgnoringRoundingError(
      (innerWidthMm * widthRatio) / fontSizeMm
    )
    const lines = wrapAnnotationParagraphs(paragraphs, charactersPerLine)
    const wrappedText = lines.join("\n")
    if (candidatesByText.has(wrappedText)) return

    candidatesByText.set(
      wrappedText,
      boxOfLines(lines, fontSizeMm, paperDimensions, inkGrid)
    )
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
  const paragraphs = toAnnotationParagraphs(input.annotationText)
  if (paragraphs.length === 0) return null

  const summedAreaTable = dilatedSummedAreaTableOf(inkGrid)
  const fontSizes = listFontSizesToTry(input.fontSizeMm)

  for (const fontSizeMm of fontSizes) {
    const candidates = buildWrappedCandidates(
      paragraphs,
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
    paragraphs,
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

interface AnnotationFitInput {
  /** 改行を入れた注釈文（`\n` で行に分ける） */
  wrappedText: string
  /** 左上の位置（用紙比） */
  x: number
  y: number
  /** 文字の大きさ（mm） */
  fontSizeMm: number
  paperDimensions: PaperDimensionsMm
  /** 解答欄の内側の占有グリッド */
  inkGrid: AnswerInkGrid
}

/**
 * 改行を入れた注釈文を、その位置・その文字の大きさのまま置いたとき、枠（グリッドの範囲）に収まり
 * 手書きに重ならないか（`placeAnnotation` と同じく、グリッドを1セル膨らませて判定する）。
 * 置いてある朱書きの文を書き換えるとき、位置と大きさを保てるかを見るのに使う
 */
export function fitsAnnotationAt(input: AnnotationFitInput): boolean {
  const { inkGrid } = input
  const box = boxOfLines(
    input.wrappedText.split("\n"),
    input.fontSizeMm,
    input.paperDimensions,
    inkGrid
  )
  const column = floorIgnoringRoundingError(
    (input.x - inkGrid.originX) / inkGrid.cellWidth
  )
  const row = floorIgnoringRoundingError(
    (input.y - inkGrid.originY) / inkGrid.cellHeight
  )
  if (
    column < 0 ||
    row < 0 ||
    column + box.columnSpan > inkGrid.columnCount ||
    row + box.rowSpan > inkGrid.rowCount
  ) {
    return false
  }
  return (
    countOccupiedCells(
      dilatedSummedAreaTableOf(inkGrid),
      inkGrid.columnCount + 1,
      column,
      row,
      box.columnSpan,
      box.rowSpan
    ) === 0
  )
}

/** 用紙比の矩形（左上と大きさ） */
export interface NormalizedRectangle {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 改行を入れた注釈文の箱の大きさ（mm）。`placeAnnotation` が自分の箱を見積もるのと同じ数え方
 * （表示幅は全角1・半角0.55、行送りは `LINE_PITCH_RATIO`）。行は `\n` で分け、折り返し直さない
 */
export function measureWrappedTextMm(
  wrappedText: string,
  fontSizeMm: number
): { widthMm: number; heightMm: number } {
  const lines = wrappedText
    .split(/\r?\n/)
    .map((line) => Array.from(line.replace(/\$/g, "")))
  return {
    widthMm: Math.max(0, ...lines.map(lineDisplayWidth)) * fontSizeMm,
    heightMm: lines.length * fontSizeMm * LINE_PITCH_RATIO,
  }
}

/**
 * 矩形（用紙比）に掛かるセルを埋まっているものとしたグリッド（元のグリッドは書き換えない）。
 * 答案のほかの文字の注釈を、手書きと同じく避ける場所にするのに使う。矩形が無ければ元のグリッドをそのまま返す
 * （膨らませた累積和の表の覚えが効く）
 */
export function withOccupiedRectangles(
  inkGrid: AnswerInkGrid,
  rectangles: readonly NormalizedRectangle[]
): AnswerInkGrid {
  if (rectangles.length === 0) return inkGrid
  const occupiedCells = [...inkGrid.occupiedCells]
  rectangles.forEach((rectangle) => {
    const firstColumn = Math.max(
      0,
      floorIgnoringRoundingError(
        (rectangle.x - inkGrid.originX) / inkGrid.cellWidth
      )
    )
    const lastColumn = Math.min(
      inkGrid.columnCount,
      ceilIgnoringRoundingError(
        (rectangle.x + rectangle.width - inkGrid.originX) / inkGrid.cellWidth
      )
    )
    const firstRow = Math.max(
      0,
      floorIgnoringRoundingError(
        (rectangle.y - inkGrid.originY) / inkGrid.cellHeight
      )
    )
    const lastRow = Math.min(
      inkGrid.rowCount,
      ceilIgnoringRoundingError(
        (rectangle.y + rectangle.height - inkGrid.originY) / inkGrid.cellHeight
      )
    )
    for (let row = firstRow; row < lastRow; row += 1) {
      occupiedCells.fill(
        true,
        row * inkGrid.columnCount + firstColumn,
        row * inkGrid.columnCount + Math.max(firstColumn, lastColumn)
      )
    }
  })
  return { ...inkGrid, occupiedCells }
}
