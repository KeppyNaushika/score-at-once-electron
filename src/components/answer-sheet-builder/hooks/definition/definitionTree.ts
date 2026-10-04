/**
 * 解答用紙の木を辿って書き換える道具（触っていない枝は作り直さない）。
 *
 * reducer が使う。木の一部だけを書き換えるので、変わらなかった枝は参照ごと残し、
 * 変わっていない大問の再描画とレイアウト再計算を起こさない。
 */

import type {
  AnswerSheetDefinition,
  AsbCellParent,
  BranchQuestion,
  HeaderFieldDefinition,
  MajorQuestion,
  ManuscriptCharGuide,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

/**
 * 写した結果が全部同じなら、元の配列をそのまま返す。
 *
 * 木の一部だけを書き換えるので、触っていない枝は参照ごと残す。全部作り直すと、
 * 変わっていない大問の再描画とレイアウト再計算が毎回走る。
 */
export function mapKeepingIdentity<TItem>(
  items: TItem[],
  mapper: (item: TItem) => TItem
): TItem[] {
  let changed = false
  const mapped = items.map((item) => {
    const next = mapper(item)
    if (next !== item) changed = true
    return next
  })
  return changed ? mapped : items
}

/** 残す判定で1つも落ちなければ、元の配列をそのまま返す */
export function filterKeepingIdentity<TItem>(
  items: TItem[],
  keep: (item: TItem) => boolean
): TItem[] {
  const kept = items.filter(keep)
  return kept.length === items.length ? items : kept
}

export function mapMajorQuestions(
  state: AnswerSheetDefinition,
  mapper: (majorQuestion: MajorQuestion) => MajorQuestion
): AnswerSheetDefinition {
  const majorQuestions = mapKeepingIdentity(state.majorQuestions, mapper)
  return majorQuestions === state.majorQuestions
    ? state
    : { ...state, majorQuestions }
}

export function mapSubQuestions(
  state: AnswerSheetDefinition,
  mapper: (subQuestion: SubQuestion) => SubQuestion
): AnswerSheetDefinition {
  return mapMajorQuestions(state, (majorQuestion) => {
    const subQuestions = mapKeepingIdentity(majorQuestion.subQuestions, mapper)
    return subQuestions === majorQuestion.subQuestions
      ? majorQuestion
      : { ...majorQuestion, subQuestions }
  })
}

export function mapBranchQuestions(
  state: AnswerSheetDefinition,
  mapper: (branchQuestion: BranchQuestion) => BranchQuestion
): AnswerSheetDefinition {
  return mapSubQuestions(state, (subQuestion) => {
    const branchQuestions = mapKeepingIdentity(
      subQuestion.branchQuestions,
      mapper
    )
    return branchQuestions === subQuestion.branchQuestions
      ? subQuestion
      : { ...subQuestion, branchQuestions }
  })
}

/** セル（小問・枝問）が持つ子。どちらも同じものを同じ形で持つ */
type CellChildren = Pick<
  SubQuestion,
  "textElements" | "imageElements" | "omrConfig" | "manuscriptPaper"
>

/** 親に指されたセル（小問か枝問）の子だけを書き換える */
export function mapCellChildren(
  state: AnswerSheetDefinition,
  parent: AsbCellParent,
  mapper: (cell: CellChildren) => CellChildren
): AnswerSheetDefinition {
  if ("subQuestionId" in parent) {
    return mapSubQuestions(state, (subQuestion) =>
      subQuestion.id === parent.subQuestionId
        ? { ...subQuestion, ...mapper(subQuestion) }
        : subQuestion
    )
  }
  return mapBranchQuestions(state, (branchQuestion) =>
    branchQuestion.id === parent.branchQuestionId
      ? { ...branchQuestion, ...mapper(branchQuestion) }
      : branchQuestion
  )
}

/** 子が全部同じなら、セルの参照ごと残す */
function withCellChildren<TCell extends CellChildren>(
  cell: TCell,
  children: CellChildren
): TCell {
  if (
    children.textElements === cell.textElements &&
    children.imageElements === cell.imageElements &&
    children.omrConfig === cell.omrConfig &&
    children.manuscriptPaper === cell.manuscriptPaper
  ) {
    return cell
  }
  return { ...cell, ...children }
}

/**
 * id を持つ子を、どのセルにあっても書き換える。
 *
 * 子（テキスト・画像）の id は解答用紙の中で一意なので、親がどちらのセルかを
 * 呼び出し側が知らなくてよい。当たらなかったセルは参照ごと残す。
 */
export function mapAllCellChildren(
  state: AnswerSheetDefinition,
  mapper: (cell: CellChildren) => CellChildren
): AnswerSheetDefinition {
  return mapBranchQuestions(
    mapSubQuestions(state, (subQuestion) =>
      withCellChildren(subQuestion, mapper(subQuestion))
    ),
    (branchQuestion) => withCellChildren(branchQuestion, mapper(branchQuestion))
  )
}

/** `orderedIds` の並びへ並べ替える（並びに無いものは末尾に元の順で残す） */
export function sortByIds<TItem extends { id: string }>(
  items: TItem[],
  orderedIds: string[]
): TItem[] {
  const position = new Map(orderedIds.map((id, index) => [id, index]))
  return [...items].sort(
    (itemA, itemB) =>
      (position.get(itemA.id) ?? orderedIds.length) -
      (position.get(itemB.id) ?? orderedIds.length)
  )
}

/** ヘッダー項目は用紙設定の中にいる。並びの位置を `order` にも写す */
export function withHeaderFields(
  state: AnswerSheetDefinition,
  headerFields: HeaderFieldDefinition[]
): AnswerSheetDefinition {
  return {
    ...state,
    settings: {
      ...state.settings,
      headerFields: headerFields.map((headerField, order) =>
        headerField.order === order ? headerField : { ...headerField, order }
      ),
    },
  }
}

/** id で指した原稿用紙の文字位置マーカーを書き換える */
export function mapCharGuides(
  state: AnswerSheetDefinition,
  manuscriptPaperId: string,
  mapper: (charGuides: ManuscriptCharGuide[]) => ManuscriptCharGuide[]
): AnswerSheetDefinition {
  return mapAllCellChildren(state, (cell) =>
    cell.manuscriptPaper?.id === manuscriptPaperId
      ? withCharGuides(cell, mapper(cell.manuscriptPaper.charGuides))
      : cell
  )
}

/**
 * どのセルにあっても、文字位置マーカーを書き換える。
 *
 * マーカーの id は解答用紙の中で一意なので、どの原稿用紙にぶら下がっているかを
 * 呼び出し側が知らなくてよい（テキスト要素・画像要素と同じ）。
 */
export function mapAllCharGuides(
  state: AnswerSheetDefinition,
  mapper: (charGuides: ManuscriptCharGuide[]) => ManuscriptCharGuide[]
): AnswerSheetDefinition {
  return mapAllCellChildren(state, (cell) =>
    cell.manuscriptPaper
      ? withCharGuides(cell, mapper(cell.manuscriptPaper.charGuides))
      : cell
  )
}

/** マーカーが全部同じなら、原稿用紙の参照ごと残す */
function withCharGuides(
  cell: CellChildren,
  charGuides: ManuscriptCharGuide[]
): CellChildren {
  const manuscriptPaper = cell.manuscriptPaper
  if (!manuscriptPaper || charGuides === manuscriptPaper.charGuides) return cell
  return { ...cell, manuscriptPaper: { ...manuscriptPaper, charGuides } }
}
