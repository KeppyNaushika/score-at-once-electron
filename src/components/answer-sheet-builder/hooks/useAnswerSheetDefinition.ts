/**
 * 解答用紙の編集状態（useReducer + undo/redo）と、編集の意図の組み立て。
 *
 * **対象は id で指す。** 添字で指すと、その添字が「どの行を書くか」の決定に使われる。
 * 新しい実体はここ（呼び出し側）で作って action に載せる。reducer の中で作ると、
 * 作った id を呼び出し側が知れず、対応する書き込みを組み立てられない。
 *
 * **画面は属性の一部を触り、action は属性ひとそろいを運ぶ。** 「配点だけ」「余白だけ」と
 * いう触り方と、「その行の列を書く」という書き込みの単位は別のものなので、足りない分を
 * 今の状態から埋めるのはここが受け持つ。
 *
 * **書き込み（DB への保存）はここではしない。** 編集が起きたことを `onEdit` で伝え、
 * 実際に書くのは編集画面（`AnswerSheetBuilderMainView`）。フックは DB を触らない
 * （docs/coding-style.md「フックはデータを受け取る。取らない・書かない」）。
 */

import { useCallback, useEffect, useMemo, useRef } from "react"

import type {
  AnswerSheetAction,
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  AsbBranchQuestionAttributes,
  AsbCellParent,
  AsbCharGuideAttributes,
  AsbDefinitionAttributes,
  AsbDefinitionUpdate,
  AsbHeaderFieldAttributes,
  AsbImageElementAttributes,
  AsbMajorQuestionAttributes,
  AsbManuscriptPaperSettings,
  AsbSubQuestionAttributes,
  AsbSubQuestionUpdate,
  AsbTextElementAttributes,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  HeaderFieldDefinition,
  LabelAssignment,
  LabelCategory,
  LabelPresets,
  MajorQuestion,
  ManuscriptCharGuide,
  ManuscriptPaper,
  NextPlacement,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import type { OMRCellConfig } from "@/types/omr.types"

import {
  createDefaultBranchQuestion,
  createDefaultDefinition,
  createDefaultHeaderField,
  createDefaultMajorQuestion,
  createDefaultSubQuestion,
  createDefaultTextElement,
  generateId,
  getCircledNumber,
  parsePresetLabels,
} from "../constants"
import type { AsbEditorActions } from "../types"
import { useUndoableReducer } from "./useUndoableReducer"

// =====================================================================
// 木を辿る（触っていない枝は作り直さない）
// =====================================================================

/**
 * 写した結果が全部同じなら、元の配列をそのまま返す。
 *
 * 木の一部だけを書き換えるので、触っていない枝は参照ごと残す。全部作り直すと、
 * 変わっていない大問の再描画とレイアウト再計算が毎回走る。
 */
function mapKeepingIdentity<TItem>(
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
function filterKeepingIdentity<TItem>(
  items: TItem[],
  keep: (item: TItem) => boolean
): TItem[] {
  const kept = items.filter(keep)
  return kept.length === items.length ? items : kept
}

function mapMajorQuestions(
  state: AnswerSheetDefinition,
  mapper: (majorQuestion: MajorQuestion) => MajorQuestion
): AnswerSheetDefinition {
  const majorQuestions = mapKeepingIdentity(state.majorQuestions, mapper)
  return majorQuestions === state.majorQuestions
    ? state
    : { ...state, majorQuestions }
}

function mapSubQuestions(
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

function mapBranchQuestions(
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
function mapCellChildren(
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
function mapAllCellChildren(
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
function sortByIds<TItem extends { id: string }>(
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

// =====================================================================
// reducer
// =====================================================================

function reducer(
  state: AnswerSheetDefinition,
  action: AnswerSheetAction
): AnswerSheetDefinition {
  switch (action.type) {
    case "SET_DEFINITION":
      return action.payload

    case "UPDATE_DEFINITION": {
      const { attributes } = action.payload
      // ヘッダー項目は用紙設定の中に居るが別テーブルの実体なので、属性には含まれない
      return {
        ...state,
        ...attributes,
        settings: {
          ...attributes.settings,
          headerFields: state.settings.headerFields,
        },
      }
    }

    case "APPLY_LABEL_PRESET": {
      const { category, preset, relabeled } = action.payload
      const labelPresets: LabelPresets = {
        ...state.labelPresets,
        [category]: preset,
      }
      const labels = new Map(
        relabeled.map((assignment) => [assignment.id, assignment.label])
      )
      const relabel = <TQuestion extends { id: string; label: string }>(
        question: TQuestion
      ): TQuestion => {
        const label = labels.get(question.id)
        return label === undefined || label === question.label
          ? question
          : { ...question, label }
      }
      const relabeledState =
        category === "major"
          ? mapMajorQuestions(state, relabel)
          : category === "sub"
            ? mapSubQuestions(state, relabel)
            : mapBranchQuestions(state, relabel)
      return { ...relabeledState, labelPresets }
    }

    // ---------- ヘッダー項目 ----------

    case "ADD_HEADER_FIELD":
      return withHeaderFields(state, [
        ...state.settings.headerFields,
        action.payload.headerField,
      ])

    case "UPDATE_HEADER_FIELD": {
      const { headerFieldId, attributes } = action.payload
      return withHeaderFields(
        state,
        mapKeepingIdentity(state.settings.headerFields, (headerField) =>
          headerField.id === headerFieldId
            ? { ...headerField, ...attributes }
            : headerField
        )
      )
    }

    case "DELETE_HEADER_FIELD":
      return withHeaderFields(
        state,
        state.settings.headerFields.filter(
          (headerField) => headerField.id !== action.payload.headerFieldId
        )
      )

    case "REORDER_HEADER_FIELDS":
      return withHeaderFields(
        state,
        sortByIds(state.settings.headerFields, action.payload.orderedIds)
      )

    // ---------- 大問 ----------

    case "ADD_MAJOR_QUESTION":
      return {
        ...state,
        majorQuestions: [...state.majorQuestions, action.payload.majorQuestion],
      }

    case "UPDATE_MAJOR_QUESTION": {
      const { majorQuestionId, attributes } = action.payload
      return mapMajorQuestions(state, (majorQuestion) =>
        majorQuestion.id === majorQuestionId
          ? { ...majorQuestion, ...attributes }
          : majorQuestion
      )
    }

    case "DELETE_MAJOR_QUESTION":
      return {
        ...state,
        majorQuestions: state.majorQuestions.filter(
          (majorQuestion) => majorQuestion.id !== action.payload.majorQuestionId
        ),
      }

    case "REORDER_MAJOR_QUESTIONS":
      return {
        ...state,
        majorQuestions: sortByIds(
          state.majorQuestions,
          action.payload.orderedIds
        ),
      }

    // ---------- 小問 ----------

    case "ADD_SUB_QUESTION": {
      const { majorQuestionId, subQuestion } = action.payload
      return mapMajorQuestions(state, (majorQuestion) =>
        majorQuestion.id === majorQuestionId
          ? {
              ...majorQuestion,
              subQuestions: [...majorQuestion.subQuestions, subQuestion],
            }
          : majorQuestion
      )
    }

    case "UPDATE_SUB_QUESTION": {
      const { subQuestionId, attributes } = action.payload
      return mapSubQuestions(state, (subQuestion) =>
        subQuestion.id === subQuestionId
          ? { ...subQuestion, ...attributes }
          : subQuestion
      )
    }

    case "DELETE_SUB_QUESTION":
      return mapMajorQuestions(state, (majorQuestion) => {
        const subQuestions = majorQuestion.subQuestions.filter(
          (subQuestion) => subQuestion.id !== action.payload.subQuestionId
        )
        return subQuestions.length === majorQuestion.subQuestions.length
          ? majorQuestion
          : { ...majorQuestion, subQuestions }
      })

    case "REORDER_SUB_QUESTIONS": {
      const { majorQuestionId, orderedIds } = action.payload
      return mapMajorQuestions(state, (majorQuestion) =>
        majorQuestion.id === majorQuestionId
          ? {
              ...majorQuestion,
              subQuestions: sortByIds(majorQuestion.subQuestions, orderedIds),
            }
          : majorQuestion
      )
    }

    // ---------- 枝問 ----------

    case "ADD_BRANCH_QUESTION": {
      const { subQuestionId, branchQuestion } = action.payload
      return mapSubQuestions(state, (subQuestion) =>
        subQuestion.id === subQuestionId
          ? {
              ...subQuestion,
              branchQuestions: [...subQuestion.branchQuestions, branchQuestion],
            }
          : subQuestion
      )
    }

    case "UPDATE_BRANCH_QUESTION": {
      const { branchQuestionId, attributes } = action.payload
      return mapBranchQuestions(state, (branchQuestion) =>
        branchQuestion.id === branchQuestionId
          ? { ...branchQuestion, ...attributes }
          : branchQuestion
      )
    }

    case "DELETE_BRANCH_QUESTION":
      return mapSubQuestions(state, (subQuestion) => {
        const branchQuestions = subQuestion.branchQuestions.filter(
          (branchQuestion) =>
            branchQuestion.id !== action.payload.branchQuestionId
        )
        return branchQuestions.length === subQuestion.branchQuestions.length
          ? subQuestion
          : { ...subQuestion, branchQuestions }
      })

    case "REORDER_BRANCH_QUESTIONS": {
      const { subQuestionId, orderedIds } = action.payload
      return mapSubQuestions(state, (subQuestion) =>
        subQuestion.id === subQuestionId
          ? {
              ...subQuestion,
              branchQuestions: sortByIds(
                subQuestion.branchQuestions,
                orderedIds
              ),
            }
          : subQuestion
      )
    }

    // ---------- セルの中身 ----------

    case "ADD_TEXT_ELEMENT": {
      const { parent, textElement } = action.payload
      return mapCellChildren(state, parent, (cell) => ({
        ...cell,
        textElements: [...cell.textElements, textElement],
      }))
    }

    case "UPDATE_TEXT_ELEMENT": {
      const { textElementId, attributes } = action.payload
      return mapAllCellChildren(state, (cell) => ({
        ...cell,
        textElements: mapKeepingIdentity(cell.textElements, (textElement) =>
          textElement.id === textElementId
            ? { ...textElement, ...attributes }
            : textElement
        ),
      }))
    }

    case "DELETE_TEXT_ELEMENT":
      return mapAllCellChildren(state, (cell) => ({
        ...cell,
        textElements: filterKeepingIdentity(
          cell.textElements,
          (textElement) => textElement.id !== action.payload.textElementId
        ),
      }))

    case "ADD_IMAGE_ELEMENT": {
      const { parent, imageElement } = action.payload
      return mapCellChildren(state, parent, (cell) => ({
        ...cell,
        imageElements: [...(cell.imageElements ?? []), imageElement],
      }))
    }

    case "UPDATE_IMAGE_ELEMENT": {
      const { imageElementId, attributes } = action.payload
      return mapAllCellChildren(state, (cell) => ({
        ...cell,
        imageElements:
          cell.imageElements &&
          mapKeepingIdentity(cell.imageElements, (imageElement) =>
            imageElement.id === imageElementId
              ? { ...imageElement, ...attributes }
              : imageElement
          ),
      }))
    }

    case "DELETE_IMAGE_ELEMENT":
      return mapAllCellChildren(state, (cell) => ({
        ...cell,
        imageElements:
          cell.imageElements &&
          filterKeepingIdentity(
            cell.imageElements,
            (imageElement) => imageElement.id !== action.payload.imageElementId
          ),
      }))

    case "UPSERT_OMR_CONFIG": {
      const { parent, config } = action.payload
      return mapCellChildren(state, parent, (cell) => ({
        ...cell,
        omrConfig: config,
      }))
    }

    case "DELETE_OMR_CONFIG":
      return mapCellChildren(state, action.payload.parent, (cell) => ({
        ...cell,
        omrConfig: undefined,
      }))

    // ---------- 原稿用紙 ----------

    case "SET_MANUSCRIPT_PAPER_ENABLED": {
      const { parent, manuscriptPaperId, enabled, initialSettings } =
        action.payload
      return mapCellChildren(state, parent, (cell) => ({
        ...cell,
        // 行がまだ無いセルはここで作る。既に在るなら設定も文字位置マーカーも残す
        // （オフは「いまは使わない」であって、捨てることではない）
        manuscriptPaper: cell.manuscriptPaper
          ? { ...cell.manuscriptPaper, enabled }
          : {
              ...initialSettings,
              enabled,
              id: manuscriptPaperId,
              charGuides: [],
            },
      }))
    }

    case "UPDATE_MANUSCRIPT_PAPER": {
      const { manuscriptPaperId, attributes } = action.payload
      return mapAllCellChildren(state, (cell) =>
        cell.manuscriptPaper?.id === manuscriptPaperId
          ? {
              ...cell,
              manuscriptPaper: { ...cell.manuscriptPaper, ...attributes },
            }
          : cell
      )
    }

    case "ADOPT_MANUSCRIPT_PAPER_ID": {
      const { parent, manuscriptPaperId } = action.payload
      return mapCellChildren(state, parent, (cell) => ({
        ...cell,
        manuscriptPaper: cell.manuscriptPaper && {
          ...cell.manuscriptPaper,
          id: manuscriptPaperId,
        },
      }))
    }

    // ---------- 文字位置マーカー ----------

    case "ADD_CHAR_GUIDE": {
      const { manuscriptPaperId, charGuide } = action.payload
      return mapCharGuides(state, manuscriptPaperId, (charGuides) => [
        ...charGuides,
        charGuide,
      ])
    }

    case "UPDATE_CHAR_GUIDE": {
      const { charGuideId, attributes } = action.payload
      return mapAllCharGuides(state, (charGuides) =>
        mapKeepingIdentity(charGuides, (charGuide) =>
          charGuide.id === charGuideId
            ? { ...charGuide, ...attributes }
            : charGuide
        )
      )
    }

    case "DELETE_CHAR_GUIDE":
      return mapAllCharGuides(state, (charGuides) =>
        filterKeepingIdentity(
          charGuides,
          (charGuide) => charGuide.id !== action.payload.charGuideId
        )
      )

    default:
      return state
  }
}

/** ヘッダー項目は用紙設定の中にいる。並びの位置を `order` にも写す */
function withHeaderFields(
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
function mapCharGuides(
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
function mapAllCharGuides(
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

// =====================================================================
// 実体から「自身の属性」を取り出す
// =====================================================================

function definitionAttributes(
  definition: AnswerSheetDefinition
): AsbDefinitionAttributes {
  const { headerFields, ...settings } = definition.settings
  return {
    name: definition.name,
    labelPresets: definition.labelPresets,
    settings,
  }
}

function headerFieldAttributes(
  headerField: HeaderFieldDefinition
): AsbHeaderFieldAttributes {
  const { id, order, ...attributes } = headerField
  return attributes
}

function majorQuestionAttributes(
  majorQuestion: MajorQuestion
): AsbMajorQuestionAttributes {
  return { label: majorQuestion.label }
}

function subQuestionAttributes(
  subQuestion: SubQuestion
): AsbSubQuestionAttributes {
  const {
    id,
    branchQuestions,
    textElements,
    imageElements,
    omrConfig,
    manuscriptPaper,
    ...attributes
  } = subQuestion
  return attributes
}

/** 原稿用紙から見た目の設定だけを取り出す（オンオフは別の意図が書く） */
function manuscriptPaperSettings(
  manuscriptPaper: ManuscriptPaper
): AsbManuscriptPaperSettings {
  const { id, charGuides, enabled, ...settings } = manuscriptPaper
  return settings
}

function branchQuestionAttributes(
  branchQuestion: BranchQuestion
): AsbBranchQuestionAttributes {
  const {
    id,
    textElements,
    imageElements,
    omrConfig,
    manuscriptPaper,
    ...attributes
  } = branchQuestion
  return attributes
}

function textElementAttributes(
  textElement: CellTextElement
): AsbTextElementAttributes {
  const { id, ...attributes } = textElement
  return attributes
}

function imageElementAttributes(
  imageElement: CellImageElement
): AsbImageElementAttributes {
  const { id, ...attributes } = imageElement
  return attributes
}

function charGuideAttributes(
  charGuide: ManuscriptCharGuide
): AsbCharGuideAttributes {
  const { id, ...attributes } = charGuide
  return attributes
}

// =====================================================================
// 木から実体を引く
// =====================================================================

/** 並びの中での位置つきで引いた実体（隣を見る操作に要る） */
interface QuestionPosition<TQuestion> {
  question: TQuestion
  siblings: TQuestion[]
  index: number
}

function findSubQuestion(
  definition: AnswerSheetDefinition,
  subQuestionId: string
): QuestionPosition<SubQuestion> | null {
  for (const majorQuestion of definition.majorQuestions) {
    const index = majorQuestion.subQuestions.findIndex(
      (subQuestion) => subQuestion.id === subQuestionId
    )
    if (index === -1) continue
    return {
      question: majorQuestion.subQuestions[index],
      siblings: majorQuestion.subQuestions,
      index,
    }
  }
  return null
}

function findBranchQuestion(
  definition: AnswerSheetDefinition,
  branchQuestionId: string
): QuestionPosition<BranchQuestion> | null {
  for (const subQuestion of allSubQuestions(definition)) {
    const index = subQuestion.branchQuestions.findIndex(
      (branchQuestion) => branchQuestion.id === branchQuestionId
    )
    if (index === -1) continue
    return {
      question: subQuestion.branchQuestions[index],
      siblings: subQuestion.branchQuestions,
      index,
    }
  }
  return null
}

function allSubQuestions(definition: AnswerSheetDefinition): SubQuestion[] {
  return definition.majorQuestions.flatMap(
    (majorQuestion) => majorQuestion.subQuestions
  )
}

/** 解答を書くセル（小問と枝問）を並べる。中身はどちらも同じ形で持つ */
function allCells(
  definition: AnswerSheetDefinition
): (SubQuestion | BranchQuestion)[] {
  return allSubQuestions(definition).flatMap((subQuestion) => [
    subQuestion,
    ...subQuestion.branchQuestions,
  ])
}

/** 親の指し方（小問か枝問か）からセルを引く */
function findCell(
  definition: AnswerSheetDefinition,
  parent: AsbCellParent
): SubQuestion | BranchQuestion | undefined {
  if ("subQuestionId" in parent) {
    return allSubQuestions(definition).find(
      (subQuestion) => subQuestion.id === parent.subQuestionId
    )
  }
  return findBranchQuestion(definition, parent.branchQuestionId)?.question
}

/** ぶつかった相手から降ろす設定（立てた側と逆の一方だけが入る） */
interface ClearedPlacement {
  nextPlacement?: undefined
  goUp?: undefined
}

/**
 * 「N行上に戻す」と「この後で改行」は隣り合う要素と両立しない。
 *
 * 片方を立てたら、ぶつかる相手の設定を降ろす。**降ろす先は別のレコードなので、別の
 * 意図として送る** — 1つの更新に隣の値を混ぜると、その隣を DB へ書く経路が無くなる。
 * 隣を見るのでここだけは並びの位置で辿る（id では「隣」を言えない）。
 */
function conflictingNeighbour<
  TQuestion extends { nextPlacement?: NextPlacement; goUp?: number },
>(
  siblings: TQuestion[],
  index: number,
  data: { goUp?: number; nextPlacement?: NextPlacement }
): { question: TQuestion; cleared: ClearedPlacement } | null {
  if (data.goUp != null && index > 0) {
    const previous = siblings[index - 1]
    if (previous.nextPlacement === "break") {
      return { question: previous, cleared: { nextPlacement: undefined } }
    }
  }
  if (data.nextPlacement === "break" && index < siblings.length - 1) {
    const next = siblings[index + 1]
    if (next.goUp != null) {
      return { question: next, cleared: { goUp: undefined } }
    }
  }
  return null
}

// =====================================================================
// フック
// =====================================================================

/** 番号の既定から、次に足す実体のラベルを引く */
function presetLabel(
  preset: string | undefined,
  index: number,
  fallback: string
): string {
  if (!preset) return fallback
  return parsePresetLabels(preset)[index] ?? fallback
}

/** 番号の既定が無いときの枝問ラベル */
const DEFAULT_BRANCH_LABELS = [
  "(ア)",
  "(イ)",
  "(ウ)",
  "(エ)",
  "(オ)",
  "(カ)",
  "(キ)",
  "(ク)",
  "(ケ)",
  "(コ)",
]

interface UseAnswerSheetDefinitionOptions {
  /** 最初に置く内容（読み込み前は既定の解答用紙） */
  initial?: AnswerSheetDefinition
  /**
   * 編集が1つ起きた。**ここで DB へ書く。**
   *
   * 呼ばれるのは実際に意図のある編集だけで、読み込み（`setDefinition`）では呼ばない。
   */
  onEdit: (action: AnswerSheetEditAction) => void
  /**
   * 過去（または先）の姿へ戻した。
   *
   * undo / redo は「文書全体の過去の姿」を復元する操作で、対応する1つの意図が無い。
   * 丸ごと置き換える経路へ流す（docs/asb-ipc-split-plan.md §6.6）。
   */
  onRestore: (definition: AnswerSheetDefinition) => void
}

/** 解答用紙の編集操作と Undo/Redo を提供するフック */
export function useAnswerSheetDefinition({
  initial,
  onEdit,
  onRestore,
}: UseAnswerSheetDefinitionOptions) {
  const {
    state: definition,
    dispatch,
    previousState,
    nextState,
    undo: undoState,
    redo: redoState,
  } = useUndoableReducer(reducer, initial ?? createDefaultDefinition())

  /**
   * いまの編集内容と、書き込み先。
   *
   * 編集の操作（`actions`）は「配点だけ」といった一部の指定を受け取り、足りない属性を
   * 今の内容から埋める。それを引数や依存に置くと**編集のたびに全部の操作が別物になり**、
   * フォームが丸ごと描き直される。最新の値は ref から読み、操作そのものは固定する。
   */
  const definitionRef = useRef(definition)
  const onEditRef = useRef(onEdit)
  const onRestoreRef = useRef(onRestore)
  useEffect(() => {
    definitionRef.current = definition
    onEditRef.current = onEdit
    onRestoreRef.current = onRestore
  })

  /** 編集を状態へ当て、同じ意図を書き込みへ渡す（**書き込みの関所**） */
  const edit = useCallback(
    (action: AnswerSheetEditAction) => {
      dispatch(action)
      onEditRef.current(action)
    },
    [dispatch]
  )

  const setDefinition = useCallback(
    (next: AnswerSheetDefinition) =>
      dispatch({ type: "SET_DEFINITION", payload: next }),
    [dispatch]
  )

  const undo = useCallback(() => {
    if (!previousState) return
    undoState()
    onRestoreRef.current(previousState)
  }, [previousState, undoState])

  const redo = useCallback(() => {
    if (!nextState) return
    redoState()
    onRestoreRef.current(nextState)
  }, [nextState, redoState])

  const updateDefinition = useCallback(
    (data: AsbDefinitionUpdate) => {
      const current = definitionAttributes(definitionRef.current)
      edit({
        type: "UPDATE_DEFINITION",
        payload: {
          attributes: {
            ...current,
            ...data,
            settings: { ...current.settings, ...data.settings },
          },
        },
      })
    },
    [edit]
  )

  const applyLabelPreset = useCallback(
    (category: LabelCategory, preset: string) => {
      const labels = parsePresetLabels(preset)
      const relabeled = labelAssignments(
        definitionRef.current,
        category,
        labels
      )
      edit({
        type: "APPLY_LABEL_PRESET",
        payload: { category, preset, relabeled },
      })
    },
    [edit]
  )

  // ---------- ヘッダー項目 ----------

  const addHeaderField = useCallback(
    (defaults?: Partial<HeaderFieldDefinition>) =>
      edit({
        type: "ADD_HEADER_FIELD",
        payload: {
          headerField: createDefaultHeaderField({
            ...defaults,
            order: definitionRef.current.settings.headerFields.length,
          }),
        },
      }),
    [edit]
  )

  const updateHeaderField = useCallback(
    (headerFieldId: string, data: Partial<AsbHeaderFieldAttributes>) => {
      const headerField = definitionRef.current.settings.headerFields.find(
        (candidate) => candidate.id === headerFieldId
      )
      if (!headerField) return
      edit({
        type: "UPDATE_HEADER_FIELD",
        payload: {
          headerFieldId,
          attributes: { ...headerFieldAttributes(headerField), ...data },
        },
      })
    },
    [edit]
  )

  const deleteHeaderField = useCallback(
    (headerFieldId: string) =>
      edit({ type: "DELETE_HEADER_FIELD", payload: { headerFieldId } }),
    [edit]
  )

  const reorderHeaderFields = useCallback(
    (orderedIds: string[]) =>
      edit({ type: "REORDER_HEADER_FIELDS", payload: { orderedIds } }),
    [edit]
  )

  // ---------- 大問 ----------

  const addMajorQuestion = useCallback(() => {
    const { majorQuestions, labelPresets } = definitionRef.current
    const index = majorQuestions.length
    edit({
      type: "ADD_MAJOR_QUESTION",
      payload: {
        majorQuestion: createDefaultMajorQuestion(
          presetLabel(labelPresets?.major, index, String(index + 1)),
          presetLabel(labelPresets?.sub, 0, getCircledNumber(1))
        ),
      },
    })
  }, [edit])

  const updateMajorQuestion = useCallback(
    (majorQuestionId: string, data: Partial<AsbMajorQuestionAttributes>) => {
      const majorQuestion = definitionRef.current.majorQuestions.find(
        (candidate) => candidate.id === majorQuestionId
      )
      if (!majorQuestion) return
      edit({
        type: "UPDATE_MAJOR_QUESTION",
        payload: {
          majorQuestionId,
          attributes: { ...majorQuestionAttributes(majorQuestion), ...data },
        },
      })
    },
    [edit]
  )

  const deleteMajorQuestion = useCallback(
    (majorQuestionId: string) =>
      edit({ type: "DELETE_MAJOR_QUESTION", payload: { majorQuestionId } }),
    [edit]
  )

  const reorderMajorQuestions = useCallback(
    (orderedIds: string[]) =>
      edit({ type: "REORDER_MAJOR_QUESTIONS", payload: { orderedIds } }),
    [edit]
  )

  // ---------- 小問 ----------

  const addSubQuestion = useCallback(
    (majorQuestionId: string) => {
      const { majorQuestions, labelPresets } = definitionRef.current
      const majorQuestion = majorQuestions.find(
        (candidate) => candidate.id === majorQuestionId
      )
      if (!majorQuestion) return
      const index = majorQuestion.subQuestions.length
      edit({
        type: "ADD_SUB_QUESTION",
        payload: {
          majorQuestionId,
          subQuestion: createDefaultSubQuestion(
            presetLabel(labelPresets?.sub, index, getCircledNumber(index + 1))
          ),
        },
      })
    },
    [edit]
  )

  const updateSubQuestion = useCallback(
    (subQuestionId: string, data: AsbSubQuestionUpdate) => {
      const found = findSubQuestion(definitionRef.current, subQuestionId)
      if (!found) return
      const neighbour = conflictingNeighbour(found.siblings, found.index, data)
      if (neighbour) {
        edit({
          type: "UPDATE_SUB_QUESTION",
          payload: {
            subQuestionId: neighbour.question.id,
            attributes: {
              ...subQuestionAttributes(neighbour.question),
              ...neighbour.cleared,
            },
          },
        })
      }
      // 属性はすべて平ら（入れ子は無い）ので1回の重ね合わせで正しく混ざる。
      // 原稿用紙が小問の列だった頃はここだけ1段深く混ぜ直しており、それが
      // 「ラベルを打つと原稿用紙が消える」の正体だった
      edit({
        type: "UPDATE_SUB_QUESTION",
        payload: {
          subQuestionId,
          attributes: { ...subQuestionAttributes(found.question), ...data },
        },
      })
    },
    [edit]
  )

  const deleteSubQuestion = useCallback(
    (subQuestionId: string) =>
      edit({ type: "DELETE_SUB_QUESTION", payload: { subQuestionId } }),
    [edit]
  )

  const reorderSubQuestions = useCallback(
    (majorQuestionId: string, orderedIds: string[]) =>
      edit({
        type: "REORDER_SUB_QUESTIONS",
        payload: { majorQuestionId, orderedIds },
      }),
    [edit]
  )

  // ---------- 枝問 ----------

  const addBranchQuestion = useCallback(
    (subQuestionId: string) => {
      const found = findSubQuestion(definitionRef.current, subQuestionId)
      if (!found) return
      const index = found.question.branchQuestions.length
      edit({
        type: "ADD_BRANCH_QUESTION",
        payload: {
          subQuestionId,
          branchQuestion: createDefaultBranchQuestion(
            presetLabel(
              definitionRef.current.labelPresets?.branch,
              index,
              DEFAULT_BRANCH_LABELS[index] ?? `(${index + 1})`
            )
          ),
        },
      })
    },
    [edit]
  )

  const updateBranchQuestion = useCallback(
    (branchQuestionId: string, data: Partial<AsbBranchQuestionAttributes>) => {
      const found = findBranchQuestion(definitionRef.current, branchQuestionId)
      if (!found) return
      const neighbour = conflictingNeighbour(found.siblings, found.index, data)
      if (neighbour) {
        edit({
          type: "UPDATE_BRANCH_QUESTION",
          payload: {
            branchQuestionId: neighbour.question.id,
            attributes: {
              ...branchQuestionAttributes(neighbour.question),
              ...neighbour.cleared,
            },
          },
        })
      }
      edit({
        type: "UPDATE_BRANCH_QUESTION",
        payload: {
          branchQuestionId,
          attributes: {
            ...branchQuestionAttributes(found.question),
            ...data,
          },
        },
      })
    },
    [edit]
  )

  const deleteBranchQuestion = useCallback(
    (branchQuestionId: string) =>
      edit({ type: "DELETE_BRANCH_QUESTION", payload: { branchQuestionId } }),
    [edit]
  )

  const reorderBranchQuestions = useCallback(
    (subQuestionId: string, orderedIds: string[]) =>
      edit({
        type: "REORDER_BRANCH_QUESTIONS",
        payload: { subQuestionId, orderedIds },
      }),
    [edit]
  )

  // ---------- セルの中身 ----------

  const addTextElement = useCallback(
    (parent: AsbCellParent) =>
      edit({
        type: "ADD_TEXT_ELEMENT",
        payload: { parent, textElement: createDefaultTextElement() },
      }),
    [edit]
  )

  const updateTextElement = useCallback(
    (textElementId: string, data: Partial<AsbTextElementAttributes>) => {
      const textElement = allCells(definitionRef.current)
        .flatMap((cell) => cell.textElements)
        .find((candidate) => candidate.id === textElementId)
      if (!textElement) return
      edit({
        type: "UPDATE_TEXT_ELEMENT",
        payload: {
          textElementId,
          attributes: { ...textElementAttributes(textElement), ...data },
        },
      })
    },
    [edit]
  )

  const deleteTextElement = useCallback(
    (textElementId: string) =>
      edit({ type: "DELETE_TEXT_ELEMENT", payload: { textElementId } }),
    [edit]
  )

  const addImageElement = useCallback(
    (parent: AsbCellParent, imageElement: CellImageElement) =>
      edit({
        type: "ADD_IMAGE_ELEMENT",
        payload: { parent, imageElement },
      }),
    [edit]
  )

  const updateImageElement = useCallback(
    (imageElementId: string, data: Partial<AsbImageElementAttributes>) => {
      const imageElement = allCells(definitionRef.current)
        .flatMap((cell) => cell.imageElements ?? [])
        .find((candidate) => candidate.id === imageElementId)
      if (!imageElement) return
      edit({
        type: "UPDATE_IMAGE_ELEMENT",
        payload: {
          imageElementId,
          attributes: { ...imageElementAttributes(imageElement), ...data },
        },
      })
    },
    [edit]
  )

  const deleteImageElement = useCallback(
    (imageElementId: string) =>
      edit({ type: "DELETE_IMAGE_ELEMENT", payload: { imageElementId } }),
    [edit]
  )

  const upsertOmrConfig = useCallback(
    (parent: AsbCellParent, config: OMRCellConfig) =>
      edit({ type: "UPSERT_OMR_CONFIG", payload: { parent, config } }),
    [edit]
  )

  const deleteOmrConfig = useCallback(
    (parent: AsbCellParent) =>
      edit({ type: "DELETE_OMR_CONFIG", payload: { parent } }),
    [edit]
  )

  // ---------- 原稿用紙 ----------

  /**
   * セルが原稿用紙を使うかどうかを切り替える。**行が無ければ作る**。
   *
   * まだ原稿用紙が無いセルでは、**ここで新しい id を振る**（reducer の中で作ると、その
   * id を知れず対応する書き込みを組み立てられない）。列数などの既定は用紙設定から決まる
   * ので**画面が渡す**（`initialSettings`）。reducer も main もその値で作る — 別々の既定
   * 値を持つと、画面が見せた姿と DB の行が食い違う。
   */
  const setManuscriptPaperEnabled = useCallback(
    (
      parent: AsbCellParent,
      enabled: boolean,
      initialSettings: AsbManuscriptPaperSettings
    ) => {
      const cell = findCell(definitionRef.current, parent)
      if (!cell) return
      edit({
        type: "SET_MANUSCRIPT_PAPER_ENABLED",
        payload: {
          parent,
          manuscriptPaperId: cell.manuscriptPaper?.id ?? generateId(),
          enabled,
          initialSettings,
        },
      })
    },
    [edit]
  )

  /**
   * 原稿用紙の設定を書く。**行が在るときだけ**（設定の欄はオンのときしか出ない）。
   *
   * 画面は「列数だけ」「ガイドの位置だけ」を触るので、足りない設定はいまの姿から埋める。
   * `enabled` はここに入らない — 切り替えは別の意図である。
   */
  const updateManuscriptPaper = useCallback(
    (manuscriptPaperId: string, data: Partial<AsbManuscriptPaperSettings>) => {
      const manuscriptPaper = allCells(definitionRef.current)
        .map((cell) => cell.manuscriptPaper)
        .find((candidate) => candidate?.id === manuscriptPaperId)
      if (!manuscriptPaper) return
      edit({
        type: "UPDATE_MANUSCRIPT_PAPER",
        payload: {
          manuscriptPaperId,
          attributes: { ...manuscriptPaperSettings(manuscriptPaper), ...data },
        },
      })
    },
    [edit]
  )

  /**
   * main が書いた原稿用紙の行の id を木へ取り込む。**書き込みは起こさない**。
   *
   * 原稿用紙が木に無いセルでは新しい id を振って渡すが、DB に行が在れば main は
   * その行を更新し、渡した id は捨てられる（別の端末が先に作ったとき）。
   * 取り込まないと、木の原稿用紙は存在しない行を指したままになり、
   * 文字位置マーカーの追加が外部キーで、全体保存が親の `@unique` で落ちる。
   */
  const adoptManuscriptPaperId = useCallback(
    (parent: AsbCellParent, manuscriptPaperId: string) => {
      const cell = findCell(definitionRef.current, parent)
      if (!cell?.manuscriptPaper) return
      if (cell.manuscriptPaper.id === manuscriptPaperId) return
      dispatch({
        type: "ADOPT_MANUSCRIPT_PAPER_ID",
        payload: { parent, manuscriptPaperId },
      })
    },
    [dispatch]
  )

  // ---------- 文字位置マーカー ----------

  const addCharGuide = useCallback(
    (manuscriptPaperId: string, charGuide: ManuscriptCharGuide) =>
      edit({
        type: "ADD_CHAR_GUIDE",
        payload: { manuscriptPaperId, charGuide },
      }),
    [edit]
  )

  const updateCharGuide = useCallback(
    (charGuideId: string, data: Partial<AsbCharGuideAttributes>) => {
      const charGuide = allCells(definitionRef.current)
        .flatMap((cell) => cell.manuscriptPaper?.charGuides ?? [])
        .find((candidate) => candidate.id === charGuideId)
      if (!charGuide) return
      edit({
        type: "UPDATE_CHAR_GUIDE",
        payload: {
          charGuideId,
          attributes: { ...charGuideAttributes(charGuide), ...data },
        },
      })
    },
    [edit]
  )

  const deleteCharGuide = useCallback(
    (charGuideId: string) =>
      edit({ type: "DELETE_CHAR_GUIDE", payload: { charGuideId } }),
    [edit]
  )

  const actions = useMemo<AsbEditorActions>(
    () => ({
      updateDefinition,
      applyLabelPreset,
      addHeaderField,
      updateHeaderField,
      deleteHeaderField,
      reorderHeaderFields,
      addMajorQuestion,
      updateMajorQuestion,
      deleteMajorQuestion,
      reorderMajorQuestions,
      addSubQuestion,
      updateSubQuestion,
      deleteSubQuestion,
      reorderSubQuestions,
      addBranchQuestion,
      updateBranchQuestion,
      deleteBranchQuestion,
      reorderBranchQuestions,
      addTextElement,
      updateTextElement,
      deleteTextElement,
      addImageElement,
      updateImageElement,
      deleteImageElement,
      upsertOmrConfig,
      deleteOmrConfig,
      setManuscriptPaperEnabled,
      updateManuscriptPaper,
      addCharGuide,
      updateCharGuide,
      deleteCharGuide,
    }),
    [
      updateDefinition,
      applyLabelPreset,
      addHeaderField,
      updateHeaderField,
      deleteHeaderField,
      reorderHeaderFields,
      addMajorQuestion,
      updateMajorQuestion,
      deleteMajorQuestion,
      reorderMajorQuestions,
      addSubQuestion,
      updateSubQuestion,
      deleteSubQuestion,
      reorderSubQuestions,
      addBranchQuestion,
      updateBranchQuestion,
      deleteBranchQuestion,
      reorderBranchQuestions,
      addTextElement,
      updateTextElement,
      deleteTextElement,
      addImageElement,
      updateImageElement,
      deleteImageElement,
      upsertOmrConfig,
      deleteOmrConfig,
      setManuscriptPaperEnabled,
      updateManuscriptPaper,
      addCharGuide,
      updateCharGuide,
      deleteCharGuide,
    ]
  )

  return {
    definition,
    /** 編集の操作ひとそろい（フォームへまとめて配る） */
    actions,
    setDefinition,
    /**
     * 書いた結果を木へ取り込む（`actions` には入れない — 編集の意図ではないので、
     * フォームから呼ぶものではない）。
     */
    adoptManuscriptPaperId,
    canUndo: previousState !== undefined,
    canRedo: nextState !== undefined,
    undo,
    redo,
  }
}

/**
 * 番号の既定を、いまの木のどの実体へ当てるかを決める。
 *
 * 大問と小問は通し、枝問は小問ごとに1から振り直す（従来の見え方をそのまま保つ）。
 * **計算は renderer に置く**（docs/asb-ipc-split-plan.md §4.3）。IPC が運ぶのは結果だけ。
 */
function labelAssignments(
  definition: AnswerSheetDefinition,
  category: LabelCategory,
  labels: string[]
): LabelAssignment[] {
  if (category === "major") {
    return definition.majorQuestions.map((majorQuestion, index) => ({
      id: majorQuestion.id,
      label: labels[index] ?? majorQuestion.label,
    }))
  }
  if (category === "sub") {
    return definition.majorQuestions.flatMap((majorQuestion) =>
      majorQuestion.subQuestions.map((subQuestion, index) => ({
        id: subQuestion.id,
        label: labels[index] ?? subQuestion.label,
      }))
    )
  }
  return allSubQuestions(definition).flatMap((subQuestion) =>
    subQuestion.branchQuestions.map((branchQuestion, index) => ({
      id: branchQuestion.id,
      label: labels[index] ?? branchQuestion.label,
    }))
  )
}
