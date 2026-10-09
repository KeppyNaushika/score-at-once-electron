/**
 * 助言の朱書きの置き場所と、文を書き換えるときの折り返し（docs/vlm-grading-design.md §9）。
 *
 * 置き場所は `placeAnnotation` が占有グリッドから決める。ここが足すのは、用紙の向きの
 * 決め方と、測れなかった答案の代わりのグリッドと、朱書きの行（`DrawingAnnotation`）への詰め方。
 * 文字の大きさ（fontSize）は mm で持つ（注釈の mm 縮尺の規約）。
 */

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import { getOrientedPaperDimensions } from "@/lib/paperSize"
import {
  placeAnnotation,
  toAnnotationParagraphs,
  wrapAnnotationParagraphs,
} from "@/lib/shared/aiGrading/annotationPlacement"
import type { AnswerInkGrid } from "@/lib/shared/aiGrading/answerInkGrid"
import {
  type DrawingAnnotation,
  newDrawingAnnotation,
} from "@/types/drawingAnnotation.types"

/** 占有グリッドのセルの一辺（mm）。main の既定（`answerImage.ts`）と同じ */
const INK_GRID_CELL_SIZE_MM = 1

/** 助言の朱書きの色（手書きの注釈の既定の赤と同じ） */
const ADVICE_ANNOTATION_COLOR = DEFAULT_DRAWING_SETTINGS.strokeColor

/** 助言の朱書きの文字の大きさ（mm）。収まらなければ `placeAnnotation` が縮める */
export const ADVICE_FONT_SIZE_MM = DEFAULT_DRAWING_SETTINGS.fontSize

/** 用紙比の矩形（設問の枠） */
interface NormalizedRegion {
  x: number
  y: number
  width: number
  height: number
}

/** 用紙の寸法（mm、画像の左右・上下に合わせた向き） */
interface PaperDimensionsMm {
  width: number
  height: number
}

/**
 * 占有グリッドから用紙の向きを決め、向きを合わせた寸法（mm）を返す。
 *
 * main はグリッドを「内側の幅 × 用紙の幅 ÷ 1mm」の列数で作る。縦・横それぞれの向きで
 * 列数・行数を作り直し、作り直した数が実際の数に近いほうの向きを採る（同点なら縦）
 */
export function inferPaperDimensionsFromInkGrid(
  pageSize: string,
  inkGrid: AnswerInkGrid
): PaperDimensionsMm {
  const gridWidth = inkGrid.cellWidth * inkGrid.columnCount
  const gridHeight = inkGrid.cellHeight * inkGrid.rowCount
  const mismatchOf = (dimensions: PaperDimensionsMm) =>
    Math.abs(
      Math.max(
        1,
        Math.round((gridWidth * dimensions.width) / INK_GRID_CELL_SIZE_MM)
      ) - inkGrid.columnCount
    ) +
    Math.abs(
      Math.max(
        1,
        Math.round((gridHeight * dimensions.height) / INK_GRID_CELL_SIZE_MM)
      ) - inkGrid.rowCount
    )
  const portrait = getOrientedPaperDimensions(pageSize, false)
  const landscape = getOrientedPaperDimensions(pageSize, true)
  return mismatchOf(landscape) < mismatchOf(portrait) ? landscape : portrait
}

/**
 * 測れなかった答案のための、インクの無いグリッド（枠全体を空きとして扱う）。
 * 向きが分からないので縦として作る
 */
function emptyInkGridForRegion(
  region: NormalizedRegion,
  pageSize: string
): AnswerInkGrid {
  const paperDimensions = getOrientedPaperDimensions(pageSize, false)
  const columnCount = Math.max(
    1,
    Math.round((region.width * paperDimensions.width) / INK_GRID_CELL_SIZE_MM)
  )
  const rowCount = Math.max(
    1,
    Math.round((region.height * paperDimensions.height) / INK_GRID_CELL_SIZE_MM)
  )
  return {
    originX: region.x,
    originY: region.y,
    cellWidth: region.width / columnCount,
    cellHeight: region.height / rowCount,
    columnCount,
    rowCount,
    occupiedCells: new Array<boolean>(columnCount * rowCount).fill(false),
  }
}

/** 注釈の大きさの換算に使う用紙の寸法（mm）。グリッドが無ければ縦とみなす */
function resolvePaperDimensions(
  pageSize: string,
  inkGrid: AnswerInkGrid | null
): PaperDimensionsMm {
  return inkGrid
    ? inferPaperDimensionsFromInkGrid(pageSize, inkGrid)
    : getOrientedPaperDimensions(pageSize, false)
}

/** 答案1件の朱書きを置くのに要るもの */
export interface AdvicePlacementContext {
  /** 答案のその設問の占有グリッド。測れなかったら null（枠全体を空きとして置く） */
  inkGrid: AnswerInkGrid | null
  region: NormalizedRegion
  pageSize: string
}

/**
 * 助言の朱書きを、手書きに重ならない位置に置いた行（まだ保存しない）。文が空なら null。
 * 印（`isRubricAdvice`）を立て、置き場所は左上の角で持つ
 */
export function placeAdviceAnnotation(
  adviceText: string,
  { inkGrid, region, pageSize }: AdvicePlacementContext
): DrawingAnnotation | null {
  const placement = placeAnnotation({
    annotationText: adviceText,
    fontSizeMm: ADVICE_FONT_SIZE_MM,
    paperDimensions: resolvePaperDimensions(pageSize, inkGrid),
    inkGrid: inkGrid ?? emptyInkGridForRegion(region, pageSize),
  })
  if (!placement) return null
  return newDrawingAnnotation({
    type: "text",
    x: placement.x,
    y: placement.y,
    text: placement.text,
    fontSize: placement.fontSize,
    color: ADVICE_ANNOTATION_COLOR,
    strokeWidth: 1,
    anchorDirection: "top-left",
    isRubricAdvice: true,
  })
}

/**
 * 置いてある朱書きの文を書き換えるときの、改行を入れた文。**位置と文字の大きさは変えない**
 * （教員が動かした位置を保つ）。朱書きの左端から枠の右端までの幅で、段落ごとに折り返す
 */
export function rewrapAdviceText(
  adviceText: string,
  annotation: Pick<DrawingAnnotation, "x" | "fontSize">,
  { inkGrid, region, pageSize }: AdvicePlacementContext
): string {
  const paperDimensions = resolvePaperDimensions(pageSize, inkGrid)
  const availableWidthMm =
    (region.x + region.width - annotation.x) * paperDimensions.width
  const charactersPerLine = Math.max(
    1,
    Math.floor(availableWidthMm / Math.max(annotation.fontSize, 0.1))
  )
  return wrapAnnotationParagraphs(
    toAnnotationParagraphs(adviceText),
    charactersPerLine
  ).join("\n")
}

/**
 * 朱書きの文を、比べるための形にする（空白・改行・`$` を除く）。置いたときの折り返しや
 * 段落の区切りが違っても、同じ助言なら同じになる
 */
export function normalizeAdviceText(adviceText: string): string {
  return adviceText.replace(/[\s$]+/g, "")
}
