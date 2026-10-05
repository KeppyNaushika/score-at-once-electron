/**
 * 採用するときの注釈（朱書き）の置き場所（docs/vlm-grading-design.md §8）。
 *
 * 置き場所は `placeAnnotation` が占有グリッドから決める。ここが足すのは、
 * 用紙の向きの決め方と、測れなかった答案の代わりのグリッドだけ。
 */

import type { AiGradingAdoption } from "@/electron-src/lib/prisma/aiGradingAdoption"
import { getOrientedPaperDimensions } from "@/lib/paperSize"
import {
  type AnnotationPlacement,
  placeAnnotation,
} from "@/lib/shared/aiGrading/annotationPlacement"
import type { AnswerInkGrid } from "@/lib/shared/aiGrading/answerInkGrid"
import {
  type DrawingAnnotation,
  newDrawingAnnotation,
} from "@/types/drawingAnnotation.types"

/** 占有グリッドのセルの一辺（mm）。main の既定（`answerImage.ts`）と同じ */
const INK_GRID_CELL_SIZE_MM = 1

/** 用紙比の矩形（設問の枠） */
interface NormalizedRegion {
  x: number
  y: number
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
): { width: number; height: number } {
  const gridWidth = inkGrid.cellWidth * inkGrid.columnCount
  const gridHeight = inkGrid.cellHeight * inkGrid.rowCount
  const mismatchOf = (dimensions: { width: number; height: number }) =>
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
export function emptyInkGridForRegion(
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

export interface AdoptionAnnotationInput {
  annotationText: string
  /** 答案のその設問の占有グリッド。測れなかったら null（枠全体を空きとして置く） */
  inkGrid: AnswerInkGrid | null
  region: NormalizedRegion
  pageSize: string
  fontSizeMm: number
}

/** 注釈の大きさの換算に使う用紙の寸法（mm）。グリッドが無ければ縦とみなす */
function resolveAnnotationPaperDimensions(
  pageSize: string,
  inkGrid: AnswerInkGrid | null
): { width: number; height: number } {
  return inkGrid
    ? inferPaperDimensionsFromInkGrid(pageSize, inkGrid)
    : getOrientedPaperDimensions(pageSize, false)
}

/** 注釈の置き場所。注釈文が空なら null */
export function placeAdoptionAnnotation(
  input: AdoptionAnnotationInput
): AnnotationPlacement | null {
  const inkGrid =
    input.inkGrid ?? emptyInkGridForRegion(input.region, input.pageSize)
  const paperDimensions = resolveAnnotationPaperDimensions(
    input.pageSize,
    input.inkGrid
  )
  return placeAnnotation({
    annotationText: input.annotationText,
    fontSizeMm: input.fontSizeMm,
    paperDimensions,
    inkGrid,
  })
}

/** 採用1件の中身（注釈が無ければ annotation は null） */
export function buildAdoption(
  attemptId: string,
  placement: AnnotationPlacement | null
): AiGradingAdoption {
  return {
    attemptId,
    annotation: placement
      ? {
          x: placement.x,
          y: placement.y,
          text: placement.text,
          fontSize: placement.fontSize,
        }
      : null,
  }
}

/** main が採用の注釈に付ける色（`aiGradingAdoption.ts` と同じ。見本と採用後を揃える） */
const ADOPTION_ANNOTATION_COLOR = "#ef4444"

/**
 * 採用前の朱書きの下書き（個別表示の編集の部品に渡す、まだ保存しない注釈）。
 * 置き場所が無ければ空。id は呼ぶたびに変わるので、呼び出し側で置き場所ごとに1回だけ作る
 */
export function draftAnnotationsFromPlacement(
  placement: AnnotationPlacement | null
): DrawingAnnotation[] {
  if (!placement) return []
  return [
    newDrawingAnnotation({
      type: "text",
      x: placement.x,
      y: placement.y,
      text: placement.text,
      fontSize: placement.fontSize,
      color: ADOPTION_ANNOTATION_COLOR,
      anchorDirection: "top-left",
    }),
  ]
}

/**
 * 教員が直した下書きから、採用で書く注釈を取る。文字のある最初のテキスト注釈を使い、
 * 消されていれば（文字のある注釈が無ければ）注釈なしで採用する
 */
export function adoptionAnnotationFromDraft(
  draftAnnotations: readonly DrawingAnnotation[]
): AiGradingAdoption["annotation"] {
  const textAnnotation = draftAnnotations.find(
    (drawingAnnotation) =>
      drawingAnnotation.type === "text" && drawingAnnotation.text.trim() !== ""
  )
  return textAnnotation
    ? {
        x: textAnnotation.x,
        y: textAnnotation.y,
        text: textAnnotation.text,
        fontSize: textAnnotation.fontSize,
      }
    : null
}
