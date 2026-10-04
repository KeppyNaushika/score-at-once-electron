/**
 * 用紙の寸法と、設問を並べる領域の範囲。
 *
 * 単一ページ・複数ページのどちらも、配置を始める前にここで同じ値を決める。
 */

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type { ComputedHeaderField } from "@/types/answerSheetLayout.types"

import { computeHeaderFieldLayout } from "./headerFieldLayout"
import { getPaperDimensions } from "./layoutUtils"

interface PaperSize {
  width: number
  height: number
}

interface PageGeometry {
  /** 縦組みか。縦組みは論理（横組み）で計算し、最後に transpose して実寸へ写す */
  vertical: boolean
  /** 実寸の用紙 */
  realPaper: PaperSize
  /** 計算に使う論理の用紙（縦組みでは幅と高さを入れ替えたもの） */
  paper: PaperSize
  contentLeft: number
  contentRight: number
  /** 設問を置き始める Y（ヘッダー記入欄の下） */
  contentTop: number
  /** 設問を置ける Y の下限（これを超えたら溢れ） */
  contentMaxY: number
  headerFields: ComputedHeaderField[]
  majorNumWidth: number
  subNumWidth: number
  /** 枝問が1つも無ければ 0（枝問番号列を取らない） */
  branchNumWidth: number
  hasBranch: boolean
}

/** 解答用紙の用紙設定から、ページの寸法と設問領域の範囲を決める */
export function computePageGeometry(
  definition: AnswerSheetDefinition
): PageGeometry {
  const { settings, majorQuestions } = definition
  const vertical = settings.verticalLayout ?? false
  // 縦組みは「幅高さを入れ替えた論理ページ」で計算し、最終段で transpose して実寸へ写す
  const realPaper = getPaperDimensions(settings)
  const paper = vertical
    ? { width: realPaper.height, height: realPaper.width }
    : realPaper
  const { margins, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right

  // ヘッダーフィールドレイアウト計算
  const headerLayout = computeHeaderFieldLayout(
    settings,
    contentLeft,
    margins.top,
    contentRight
  )
  const effectiveHeaderHeight =
    headerLayout.totalHeightMm > 0
      ? headerLayout.totalHeightMm + 2 + spacing.headerHeight
      : spacing.headerHeight

  const hasBranch = majorQuestions.some((majorQuestion) =>
    majorQuestion.subQuestions.some(
      (subQuestion) => subQuestion.branchQuestions.length > 0
    )
  )

  return {
    vertical,
    realPaper,
    paper,
    contentLeft,
    contentRight,
    contentTop: margins.top + effectiveHeaderHeight,
    contentMaxY: paper.height - margins.bottom,
    headerFields: headerLayout.fields,
    majorNumWidth: columnWidths.majorNumber,
    subNumWidth: columnWidths.subNumber,
    branchNumWidth: hasBranch ? columnWidths.branchNumber : 0,
    hasBranch,
  }
}
