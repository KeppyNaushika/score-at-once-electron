/**
 * 原稿用紙の必要幅
 *
 * マス目は「基準行高 × 倍率」の正方形で、列数ぶん横に並ぶ。だから解答欄が要る幅は
 * `基準行高 × 倍率 × 列数` に番号欄の幅を足したものになる。
 *
 * 高さは `gridTotalHeight` が枝問の実測から親へ積み上げている。幅も同じ向きで積み上げる
 * ——枝問それぞれの必要幅の最大値が、親の小問の必要幅になる。
 *
 * **割り当て（`layoutWidth`）・描画・囲み枠の右端は、必ずここの数を見る。** 3つが同じ数を
 * 見ていなかったのが、マス目が大問の枠と用紙の右端を突き抜けていた原因だった。
 */

import type {
  BranchQuestion,
  GlobalSettings,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import { getPaperDimensions } from "./layoutUtils"

/** 番号欄の実効幅（mm）。ラベルが空の設問は番号欄を持たない */
function effectiveNumberWidth(
  question: { label: string },
  numberColumnWidth: number
): number {
  return question.label === "" ? 0 : numberColumnWidth
}

/** マス目1つの一辺（mm）。マス目は正方形なので幅も高さもこれ */
export function manuscriptCellSize(
  question: { heightMultiplier: number },
  baseRowHeight: number
): number {
  return baseRowHeight * question.heightMultiplier
}

/**
 * 原稿用紙を持つ設問が要る幅（mm）。番号欄を含む。
 *
 * 受けるのは小問でも枝問でもよい（原稿用紙はセルの持ち物で、どちらにも付く）。
 * 原稿用紙を持たない設問は幅を要求しない（null）。
 */
export function requiredManuscriptWidth(
  question: SubQuestion | BranchQuestion,
  baseRowHeight: number,
  numberColumnWidth: number
): number | null {
  const manuscriptPaper = question.manuscriptPaper
  if (!manuscriptPaper?.enabled) return null
  return (
    manuscriptCellSize(question, baseRowHeight) * manuscriptPaper.columns +
    effectiveNumberWidth(question, numberColumnWidth)
  )
}

/**
 * 枝問が並ぶ領域が要る幅（mm）。原稿用紙を持つ枝問が1つも無ければ null。
 *
 * 枝問は領域の中で横に並ぶが、**どれか1つでも入らなければ親がはみ出す**ので、
 * 親へ積み上げるのは最大値になる。領域幅を最大値に取れば、いちばん広い枝問がちょうど
 * 全幅（1.0）になり、それより狭い枝問だけが横に並ぶ。
 */
export function requiredBranchAreaWidth(
  branchQuestions: BranchQuestion[],
  baseRowHeight: number,
  branchNumberWidth: number
): number | null {
  const requiredWidths = branchQuestions
    .map((branchQuestion) =>
      requiredManuscriptWidth(branchQuestion, baseRowHeight, branchNumberWidth)
    )
    .filter((requiredWidth): requiredWidth is number => requiredWidth != null)
  if (requiredWidths.length === 0) return null
  return Math.max(...requiredWidths)
}

/**
 * 小問が要る幅（mm）。番号欄を含む。幅を要求しない小問は null。
 *
 * 枝問を持つ小問は、枝問の実測から積み上げる（高さを `gridTotalHeight` から
 * 積み上げるのと同じ向き）。枝問を持つ小問自身の原稿用紙は描かれないので見ない。
 */
export function requiredSubQuestionWidth(
  subQuestion: SubQuestion,
  baseRowHeight: number,
  subNumberWidth: number,
  branchNumberWidth: number
): number | null {
  if (subQuestion.branchQuestions.length > 0) {
    const branchAreaWidth = requiredBranchAreaWidth(
      subQuestion.branchQuestions,
      baseRowHeight,
      branchNumberWidth
    )
    if (branchAreaWidth == null) return null
    return branchAreaWidth + effectiveNumberWidth(subQuestion, subNumberWidth)
  }
  return requiredManuscriptWidth(subQuestion, baseRowHeight, subNumberWidth)
}

/**
 * 小問の `layoutWidth` を必要幅で書き換える。
 *
 * 割り当ての前に一度だけ通す。幅を要求しない小問はそのまま返す（画面で指定した
 * `layoutWidth` を握り潰さない）。
 */
export function withRequiredSubQuestionWidths(
  subQuestions: SubQuestion[],
  baseRowHeight: number,
  horizontalAreaWidth: number,
  subNumberWidth: number,
  branchNumberWidth: number
): SubQuestion[] {
  return subQuestions.map((subQuestion) => {
    const requiredWidth = requiredSubQuestionWidth(
      subQuestion,
      baseRowHeight,
      subNumberWidth,
      branchNumberWidth
    )
    if (requiredWidth == null) return subQuestion
    return {
      ...subQuestion,
      layoutWidth: String(requiredWidth / horizontalAreaWidth),
    }
  })
}

/**
 * 枝問の `layoutWidth` を必要幅で書き換える。
 *
 * 領域幅は `requiredBranchAreaWidth`（＝親の小問へ積み上げた幅）そのもの。親の割り当てが
 * その幅で行われるので、ここで同じ数を割れば割り当てと描画が一致する。
 */
export function withRequiredBranchQuestionWidths(
  branchQuestions: BranchQuestion[],
  baseRowHeight: number,
  branchNumberWidth: number
): BranchQuestion[] {
  const branchAreaWidth = requiredBranchAreaWidth(
    branchQuestions,
    baseRowHeight,
    branchNumberWidth
  )
  if (branchAreaWidth == null) return branchQuestions
  return branchQuestions.map((branchQuestion) => {
    const requiredWidth = requiredManuscriptWidth(
      branchQuestion,
      baseRowHeight,
      branchNumberWidth
    )
    if (requiredWidth == null) return branchQuestion
    return {
      ...branchQuestion,
      layoutWidth: String(requiredWidth / branchAreaWidth),
    }
  })
}

// =====================
// 列数の上限（入力で止めるための算出）
// =====================

/**
 * 段組み1段ぶんの中身の幅（mm）。
 *
 * 縦組みは幅高さを入れ替えた論理ページで組むので、ここでも入れ替えた側を見る。
 */
export function columnContentWidth(settings: GlobalSettings): number {
  const realPaper = getPaperDimensions(settings)
  const paperWidth = settings.verticalLayout
    ? realPaper.height
    : realPaper.width
  const fullContentWidth =
    paperWidth - settings.margins.left - settings.margins.right
  const multiColumn = settings.multiColumn
  if (!multiColumn.enabled || multiColumn.columnCount <= 1) {
    return fullContentWidth
  }
  return (
    (fullContentWidth -
      (multiColumn.columnCount - 1) * multiColumn.columnGapMm) /
    multiColumn.columnCount
  )
}

/** 小問の原稿用紙が使える幅（mm）＝段の幅 − 大問番号欄 −（小問番号欄） */
export function subManuscriptAreaWidth(
  settings: GlobalSettings,
  subQuestion: { label: string }
): number {
  return (
    columnContentWidth(settings) -
    settings.columnWidths.majorNumber -
    effectiveNumberWidth(subQuestion, settings.columnWidths.subNumber)
  )
}

/** 枝問の原稿用紙が使える幅（mm）＝小問の幅 −（枝問番号欄） */
export function branchManuscriptAreaWidth(
  settings: GlobalSettings,
  subQuestion: { label: string },
  branchQuestion: { label: string }
): number {
  return (
    subManuscriptAreaWidth(settings, subQuestion) -
    effectiveNumberWidth(branchQuestion, settings.columnWidths.branchNumber)
  )
}

/**
 * その幅に収まるマス目の最大列数。
 *
 * **既にこれを超えている定義を切り詰めるのには使わない。** 超過はそのまま描き、
 * 画面で警告する（値を勝手に書き換えると「なぜ列数が減ったのか」を追えなくなる）。
 */
export function maxManuscriptColumns(
  manuscriptAreaWidth: number,
  cellSize: number
): number {
  if (!(cellSize > 0)) return 1
  return Math.max(1, Math.floor(manuscriptAreaWidth / cellSize))
}
