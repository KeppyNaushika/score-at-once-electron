/**
 * 原稿用紙の必要幅
 *
 * マス目は「基準行高 × 倍率」の正方形で、列数ぶん横に並ぶ。だから解答欄が要る幅は
 * `基準行高 × 倍率 × 列数` に番号欄の幅を足したものになる。
 *
 * 高さは `gridTotalHeight` が枝問の実測から親へ積み上げている。幅も同じ向きで積み上げる
 * ——**枝問全員の実効幅の最大値**が、親の小問の必要幅になる。
 *
 * **実効幅は原稿用紙を持たない枝問も言う。** 原稿用紙を持つ枝問だけを数えると、
 * 隣にいる普通の解答欄がマス目の幅まで押し込まれる（元の規則で 160mm だった解答欄が
 * 48mm に縮んだ）。原稿用紙を持たない枝問の実効幅は、元の規則で決まる幅
 * ——`layoutWidth` があればその分数ぶん、無ければ親の利用可能幅いっぱい——になる。
 *
 * 不変条件はこの2つ:
 *
 * - **常に** マス目は枠に収まる（`マス目の右端 ≤ 枠の右端`）
 * - **枝問が全員原稿用紙のときだけ** 割り当て幅・描画幅・囲み枠の右端が一致する
 *
 * 「一致」を無条件の約束として書いたことが、混在（原稿用紙あり＋なし）を検査から
 * 弾いた原因だった。混在では枠は普通の枝問に合わせて広くなり、マス目とは一致しない。
 */

import type {
  BranchQuestion,
  GlobalSettings,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import { getPaperDimensions, parseFraction } from "./layoutUtils"

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
function requiredManuscriptWidth(
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
 * 枝問が並ぶ領域の、原稿用紙を見ないときの幅（mm）。
 *
 * 元の規則——`layoutWidth` があればその分数ぶん、無ければ全幅——で親の小問へ割り当てられる
 * 幅から、小問番号欄を引いたもの。**原稿用紙を持たない枝問の実効幅は、この幅を分け合う。**
 *
 * 縦配置でも同じ式で出る（縦配置の小問は `layoutWidth` を持たないので全幅になり、
 * `段の右端 − 枝問領域の左端` と一致する）。
 */
export function availableBranchAreaWidth(
  subQuestion: SubQuestion,
  horizontalAreaWidth: number,
  subNumberWidth: number
): number {
  return (
    parseFraction(subQuestion.layoutWidth ?? "1") * horizontalAreaWidth -
    effectiveNumberWidth(subQuestion, subNumberWidth)
  )
}

/**
 * 枝問1つの実効幅（mm）。番号欄を含む。
 *
 * 原稿用紙があればマス目が要る幅。無ければ元の規則で決まる幅（`layoutWidth` の分数ぶん、
 * 未指定なら領域いっぱい）。**原稿用紙の有無で数え方は変わるが、全員が幅を言う。**
 */
function effectiveBranchWidth(
  branchQuestion: BranchQuestion,
  baseRowHeight: number,
  branchNumberWidth: number,
  availableAreaWidth: number
): number {
  return (
    requiredManuscriptWidth(branchQuestion, baseRowHeight, branchNumberWidth) ??
    parseFraction(branchQuestion.layoutWidth ?? "1") * availableAreaWidth
  )
}

/**
 * 枝問が並ぶ領域が要る幅（mm）。原稿用紙を持つ枝問が1つも無ければ null。
 *
 * 枝問は領域の中で横に並ぶが、**どれか1つでも入らなければ親がはみ出す**ので、
 * 親へ積み上げるのは実効幅の最大値になる。
 *
 * - 全員が原稿用紙 → 最大値はマス目の幅。枠がマス目に寄る
 * - 混在 → 普通の枝問が最大値を押し上げるので、枠はマス目まで縮まない
 * - 原稿用紙が広すぎる → 最大値がそれになるので、マス目が枠を突き抜けない
 *
 * 原稿用紙が1つも無ければ幅を要求しない（null）。元の規則がそのまま残り、画面で指定した
 * `layoutWidth` を握り潰さない。
 */
export function requiredBranchAreaWidth(
  branchQuestions: BranchQuestion[],
  baseRowHeight: number,
  branchNumberWidth: number,
  availableAreaWidth: number
): number | null {
  const hasManuscript = branchQuestions.some(
    (branchQuestion) => branchQuestion.manuscriptPaper?.enabled
  )
  if (!hasManuscript) return null
  return Math.max(
    ...branchQuestions.map((branchQuestion) =>
      effectiveBranchWidth(
        branchQuestion,
        baseRowHeight,
        branchNumberWidth,
        availableAreaWidth
      )
    )
  )
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
  horizontalAreaWidth: number,
  subNumberWidth: number,
  branchNumberWidth: number
): number | null {
  if (subQuestion.branchQuestions.length > 0) {
    const branchAreaWidth = requiredBranchAreaWidth(
      subQuestion.branchQuestions,
      baseRowHeight,
      branchNumberWidth,
      availableBranchAreaWidth(subQuestion, horizontalAreaWidth, subNumberWidth)
    )
    if (branchAreaWidth == null) return null
    return branchAreaWidth + effectiveNumberWidth(subQuestion, subNumberWidth)
  }
  return requiredManuscriptWidth(subQuestion, baseRowHeight, subNumberWidth)
}

/**
 * 枝問の `layoutWidth` を実効幅で書き換える。
 *
 * 受け取る `availableAreaWidth` は**書き換える前**の領域幅（`availableBranchAreaWidth`）。
 * 割り当て後の領域幅は `requiredBranchAreaWidth` になるので、実効幅をそちらで割る。
 * 親の割り当てが同じ数で行われるので、割り当てと描画が食い違わない。
 */
export function withRequiredBranchQuestionWidths(
  branchQuestions: BranchQuestion[],
  baseRowHeight: number,
  branchNumberWidth: number,
  availableAreaWidth: number
): BranchQuestion[] {
  const branchAreaWidth = requiredBranchAreaWidth(
    branchQuestions,
    baseRowHeight,
    branchNumberWidth,
    availableAreaWidth
  )
  if (branchAreaWidth == null) return branchQuestions
  return branchQuestions.map((branchQuestion) => ({
    ...branchQuestion,
    layoutWidth: String(
      effectiveBranchWidth(
        branchQuestion,
        baseRowHeight,
        branchNumberWidth,
        availableAreaWidth
      ) / branchAreaWidth
    ),
  }))
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
