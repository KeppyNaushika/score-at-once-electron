/**
 * 解答用紙の編集状態（useReducer + undo/redo）。
 *
 * **対象は id で指す。** 添字で指すと、その添字が「どの行を書くか」の決定に使われる。
 * 新しい実体はここ（呼び出し側）で作って action に載せる。reducer の中で作ると、
 * 作った id を呼び出し側が知れず、対応する書き込みを組み立てられない。
 *
 * 書き込み（DB への保存）はここではしない。編集画面が持つ。
 */

import { useCallback, useMemo } from "react"

import type {
  AnswerSheetAction,
  AnswerSheetDefinition,
  AsbBranchQuestionAttributes,
  AsbCellParent,
  AsbCharGuideAttributes,
  AsbDefinitionUpdate,
  AsbHeaderFieldAttributes,
  AsbImageElementAttributes,
  AsbMajorQuestionAttributes,
  AsbSubQuestionUpdate,
  AsbTextElementAttributes,
  BranchQuestion,
  CellImageElement,
  HeaderFieldDefinition,
  LabelCategory,
  LabelPresets,
  MajorQuestion,
  ManuscriptCharGuide,
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
  DEFAULT_MANUSCRIPT_PAPER,
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
  "textElements" | "imageElements" | "omrConfig"
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
    children.omrConfig === cell.omrConfig
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
      const { settings, ...attributes } = action.payload
      return {
        ...state,
        ...attributes,
        settings: settings
          ? { ...state.settings, ...settings }
          : state.settings,
      }
    }

    case "APPLY_LABEL_PRESET": {
      const { category, preset } = action.payload
      const labelPresets: LabelPresets = {
        ...state.labelPresets,
        [category]: preset,
      }
      const labels = parsePresetLabels(preset)
      const majorQuestions = state.majorQuestions.map(
        (majorQuestion, majorIndex) => {
          if (category === "major") {
            return {
              ...majorQuestion,
              label: labels[majorIndex] ?? majorQuestion.label,
            }
          }
          if (category === "sub") {
            return {
              ...majorQuestion,
              subQuestions: majorQuestion.subQuestions.map(
                (subQuestion, subIndex) => ({
                  ...subQuestion,
                  label: labels[subIndex] ?? subQuestion.label,
                })
              ),
            }
          }
          // branch: 小問ごとに0からリスタート
          return {
            ...majorQuestion,
            subQuestions: majorQuestion.subQuestions.map((subQuestion) => ({
              ...subQuestion,
              branchQuestions: subQuestion.branchQuestions.map(
                (branchQuestion, branchIndex) => ({
                  ...branchQuestion,
                  label: labels[branchIndex] ?? branchQuestion.label,
                })
              ),
            })),
          }
        }
      )
      return { ...state, labelPresets, majorQuestions }
    }

    // ---------- ヘッダー項目 ----------

    case "ADD_HEADER_FIELD":
      return withHeaderFields(state, [
        ...state.settings.headerFields,
        action.payload.headerField,
      ])

    case "UPDATE_HEADER_FIELD": {
      const { headerFieldId, data } = action.payload
      return withHeaderFields(
        state,
        mapKeepingIdentity(state.settings.headerFields, (headerField) =>
          headerField.id === headerFieldId
            ? { ...headerField, ...data }
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
      const { majorQuestionId, data } = action.payload
      return mapMajorQuestions(state, (majorQuestion) =>
        majorQuestion.id === majorQuestionId
          ? { ...majorQuestion, ...data }
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
      const { subQuestionId, data } = action.payload
      return mapMajorQuestions(state, (majorQuestion) => {
        const subIndex = majorQuestion.subQuestions.findIndex(
          (subQuestion) => subQuestion.id === subQuestionId
        )
        if (subIndex === -1) return majorQuestion
        const subQuestions = [...majorQuestion.subQuestions]
        subQuestions[subIndex] = updatedSubQuestion(
          subQuestions[subIndex],
          data
        )
        return {
          ...majorQuestion,
          subQuestions: withExclusivePlacement(subQuestions, subIndex, data),
        }
      })
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
      const { branchQuestionId, data } = action.payload
      return mapSubQuestions(state, (subQuestion) => {
        const branchIndex = subQuestion.branchQuestions.findIndex(
          (branchQuestion) => branchQuestion.id === branchQuestionId
        )
        if (branchIndex === -1) return subQuestion
        const branchQuestions = [...subQuestion.branchQuestions]
        branchQuestions[branchIndex] = {
          ...branchQuestions[branchIndex],
          ...data,
        }
        return {
          ...subQuestion,
          branchQuestions: withExclusivePlacement(
            branchQuestions,
            branchIndex,
            data
          ),
        }
      })
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
      const { textElementId, data } = action.payload
      return mapAllCellChildren(state, (cell) => ({
        ...cell,
        textElements: mapKeepingIdentity(cell.textElements, (textElement) =>
          textElement.id === textElementId
            ? { ...textElement, ...data }
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
      const { imageElementId, data } = action.payload
      return mapAllCellChildren(state, (cell) => ({
        ...cell,
        imageElements:
          cell.imageElements &&
          mapKeepingIdentity(cell.imageElements, (imageElement) =>
            imageElement.id === imageElementId
              ? { ...imageElement, ...data }
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

    // ---------- 文字位置マーカー ----------

    case "ADD_CHAR_GUIDE": {
      const { subQuestionId, charGuide } = action.payload
      return mapCharGuides(state, (subQuestion) =>
        subQuestion.id === subQuestionId
          ? [...(subQuestion.manuscriptPaper?.charGuides ?? []), charGuide]
          : null
      )
    }

    case "UPDATE_CHAR_GUIDE": {
      const { charGuideId, data } = action.payload
      return mapCharGuides(state, (subQuestion) => {
        const charGuides = subQuestion.manuscriptPaper?.charGuides
        if (!charGuides) return null
        const mapped = mapKeepingIdentity(charGuides, (charGuide) =>
          charGuide.id === charGuideId ? { ...charGuide, ...data } : charGuide
        )
        return mapped === charGuides ? null : mapped
      })
    }

    case "DELETE_CHAR_GUIDE":
      return mapCharGuides(state, (subQuestion) => {
        const charGuides = subQuestion.manuscriptPaper?.charGuides
        if (!charGuides) return null
        const kept = charGuides.filter(
          (charGuide) => charGuide.id !== action.payload.charGuideId
        )
        return kept.length === charGuides.length ? null : kept
      })

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

/** 小問の更新。原稿用紙は一部指定なので、文字位置マーカーを残したまま重ねる */
function updatedSubQuestion(
  subQuestion: SubQuestion,
  data: AsbSubQuestionUpdate
): SubQuestion {
  const { manuscriptPaper, ...attributes } = data
  if (!manuscriptPaper) return { ...subQuestion, ...attributes }
  return {
    ...subQuestion,
    ...attributes,
    manuscriptPaper: {
      ...DEFAULT_MANUSCRIPT_PAPER,
      ...subQuestion.manuscriptPaper,
      ...manuscriptPaper,
    },
  }
}

/**
 * 「N行上に戻す」と「この後で改行」は隣り合う要素と両立しない。
 *
 * 片方を立てたら、ぶつかる相手の設定を降ろす。並びの中の隣を見るので、ここだけは
 * 位置で辿る（id では「隣」を言えない）。
 */
function withExclusivePlacement<
  TQuestion extends {
    nextPlacement?: "inline" | "break"
    goUp?: number
  },
>(
  questions: TQuestion[],
  index: number,
  data: { goUp?: number; nextPlacement?: "inline" | "break" }
): TQuestion[] {
  const updated = [...questions]
  if (data.goUp != null && index > 0) {
    const previous = updated[index - 1]
    if (previous.nextPlacement === "break") {
      updated[index - 1] = { ...previous, nextPlacement: undefined }
    }
  }
  if (data.nextPlacement === "break" && index < updated.length - 1) {
    const next = updated[index + 1]
    if (next.goUp != null) {
      updated[index + 1] = { ...next, goUp: undefined }
    }
  }
  return updated
}

/**
 * 小問の文字位置マーカーを書き換える。
 *
 * `mapper` が `null` を返した小問は触らない（対象ではなかった、という意味）。
 */
function mapCharGuides(
  state: AnswerSheetDefinition,
  mapper: (subQuestion: SubQuestion) => ManuscriptCharGuide[] | null
): AnswerSheetDefinition {
  return mapSubQuestions(state, (subQuestion) => {
    const charGuides = mapper(subQuestion)
    if (charGuides === null) return subQuestion
    return {
      ...subQuestion,
      manuscriptPaper: {
        ...DEFAULT_MANUSCRIPT_PAPER,
        ...subQuestion.manuscriptPaper,
        charGuides,
      },
    }
  })
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

/** 解答用紙の編集操作と Undo/Redo を提供するフック */
export function useAnswerSheetDefinition(initial?: AnswerSheetDefinition) {
  const {
    state: definition,
    dispatch,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useUndoableReducer(reducer, initial ?? createDefaultDefinition())

  const setDefinition = useCallback(
    (next: AnswerSheetDefinition) =>
      dispatch({ type: "SET_DEFINITION", payload: next }),
    [dispatch]
  )

  const updateDefinition = useCallback(
    (data: AsbDefinitionUpdate) =>
      dispatch({ type: "UPDATE_DEFINITION", payload: data }),
    [dispatch]
  )

  const applyLabelPreset = useCallback(
    (category: LabelCategory, preset: string) =>
      dispatch({ type: "APPLY_LABEL_PRESET", payload: { category, preset } }),
    [dispatch]
  )

  // ---------- ヘッダー項目 ----------

  const addHeaderField = useCallback(
    (defaults?: Partial<HeaderFieldDefinition>) =>
      dispatch({
        type: "ADD_HEADER_FIELD",
        payload: {
          headerField: createDefaultHeaderField({
            ...defaults,
            order: definition.settings.headerFields.length,
          }),
        },
      }),
    [dispatch, definition.settings.headerFields.length]
  )

  const updateHeaderField = useCallback(
    (headerFieldId: string, data: Partial<AsbHeaderFieldAttributes>) =>
      dispatch({
        type: "UPDATE_HEADER_FIELD",
        payload: { headerFieldId, data },
      }),
    [dispatch]
  )

  const deleteHeaderField = useCallback(
    (headerFieldId: string) =>
      dispatch({ type: "DELETE_HEADER_FIELD", payload: { headerFieldId } }),
    [dispatch]
  )

  const reorderHeaderFields = useCallback(
    (orderedIds: string[]) =>
      dispatch({ type: "REORDER_HEADER_FIELDS", payload: { orderedIds } }),
    [dispatch]
  )

  // ---------- 大問 ----------

  const addMajorQuestion = useCallback(() => {
    const index = definition.majorQuestions.length
    dispatch({
      type: "ADD_MAJOR_QUESTION",
      payload: {
        majorQuestion: createDefaultMajorQuestion(
          presetLabel(definition.labelPresets?.major, index, String(index + 1)),
          presetLabel(definition.labelPresets?.sub, 0, getCircledNumber(1))
        ),
      },
    })
  }, [dispatch, definition.majorQuestions.length, definition.labelPresets])

  const updateMajorQuestion = useCallback(
    (majorQuestionId: string, data: Partial<AsbMajorQuestionAttributes>) =>
      dispatch({
        type: "UPDATE_MAJOR_QUESTION",
        payload: { majorQuestionId, data },
      }),
    [dispatch]
  )

  const deleteMajorQuestion = useCallback(
    (majorQuestionId: string) =>
      dispatch({ type: "DELETE_MAJOR_QUESTION", payload: { majorQuestionId } }),
    [dispatch]
  )

  const reorderMajorQuestions = useCallback(
    (orderedIds: string[]) =>
      dispatch({ type: "REORDER_MAJOR_QUESTIONS", payload: { orderedIds } }),
    [dispatch]
  )

  // ---------- 小問 ----------

  const addSubQuestion = useCallback(
    (majorQuestionId: string) => {
      const majorQuestion = definition.majorQuestions.find(
        (candidate) => candidate.id === majorQuestionId
      )
      if (!majorQuestion) return
      const index = majorQuestion.subQuestions.length
      dispatch({
        type: "ADD_SUB_QUESTION",
        payload: {
          majorQuestionId,
          subQuestion: createDefaultSubQuestion(
            presetLabel(
              definition.labelPresets?.sub,
              index,
              getCircledNumber(index + 1)
            )
          ),
        },
      })
    },
    [dispatch, definition.majorQuestions, definition.labelPresets]
  )

  const updateSubQuestion = useCallback(
    (subQuestionId: string, data: AsbSubQuestionUpdate) =>
      dispatch({
        type: "UPDATE_SUB_QUESTION",
        payload: { subQuestionId, data },
      }),
    [dispatch]
  )

  const deleteSubQuestion = useCallback(
    (subQuestionId: string) =>
      dispatch({ type: "DELETE_SUB_QUESTION", payload: { subQuestionId } }),
    [dispatch]
  )

  const reorderSubQuestions = useCallback(
    (majorQuestionId: string, orderedIds: string[]) =>
      dispatch({
        type: "REORDER_SUB_QUESTIONS",
        payload: { majorQuestionId, orderedIds },
      }),
    [dispatch]
  )

  // ---------- 枝問 ----------

  const addBranchQuestion = useCallback(
    (subQuestionId: string) => {
      const subQuestion = definition.majorQuestions
        .flatMap((majorQuestion) => majorQuestion.subQuestions)
        .find((candidate) => candidate.id === subQuestionId)
      if (!subQuestion) return
      const index = subQuestion.branchQuestions.length
      dispatch({
        type: "ADD_BRANCH_QUESTION",
        payload: {
          subQuestionId,
          branchQuestion: createDefaultBranchQuestion(
            presetLabel(
              definition.labelPresets?.branch,
              index,
              DEFAULT_BRANCH_LABELS[index] ?? `(${index + 1})`
            )
          ),
        },
      })
    },
    [dispatch, definition.majorQuestions, definition.labelPresets]
  )

  const updateBranchQuestion = useCallback(
    (branchQuestionId: string, data: Partial<AsbBranchQuestionAttributes>) =>
      dispatch({
        type: "UPDATE_BRANCH_QUESTION",
        payload: { branchQuestionId, data },
      }),
    [dispatch]
  )

  const deleteBranchQuestion = useCallback(
    (branchQuestionId: string) =>
      dispatch({
        type: "DELETE_BRANCH_QUESTION",
        payload: { branchQuestionId },
      }),
    [dispatch]
  )

  const reorderBranchQuestions = useCallback(
    (subQuestionId: string, orderedIds: string[]) =>
      dispatch({
        type: "REORDER_BRANCH_QUESTIONS",
        payload: { subQuestionId, orderedIds },
      }),
    [dispatch]
  )

  // ---------- セルの中身 ----------

  const addTextElement = useCallback(
    (parent: AsbCellParent) =>
      dispatch({
        type: "ADD_TEXT_ELEMENT",
        payload: { parent, textElement: createDefaultTextElement() },
      }),
    [dispatch]
  )

  const updateTextElement = useCallback(
    (textElementId: string, data: Partial<AsbTextElementAttributes>) =>
      dispatch({
        type: "UPDATE_TEXT_ELEMENT",
        payload: { textElementId, data },
      }),
    [dispatch]
  )

  const deleteTextElement = useCallback(
    (textElementId: string) =>
      dispatch({ type: "DELETE_TEXT_ELEMENT", payload: { textElementId } }),
    [dispatch]
  )

  const addImageElement = useCallback(
    (parent: AsbCellParent, imageElement: CellImageElement) =>
      dispatch({
        type: "ADD_IMAGE_ELEMENT",
        payload: { parent, imageElement },
      }),
    [dispatch]
  )

  const updateImageElement = useCallback(
    (imageElementId: string, data: Partial<AsbImageElementAttributes>) =>
      dispatch({
        type: "UPDATE_IMAGE_ELEMENT",
        payload: { imageElementId, data },
      }),
    [dispatch]
  )

  const deleteImageElement = useCallback(
    (imageElementId: string) =>
      dispatch({ type: "DELETE_IMAGE_ELEMENT", payload: { imageElementId } }),
    [dispatch]
  )

  const upsertOmrConfig = useCallback(
    (parent: AsbCellParent, config: OMRCellConfig) =>
      dispatch({ type: "UPSERT_OMR_CONFIG", payload: { parent, config } }),
    [dispatch]
  )

  const deleteOmrConfig = useCallback(
    (parent: AsbCellParent) =>
      dispatch({ type: "DELETE_OMR_CONFIG", payload: { parent } }),
    [dispatch]
  )

  // ---------- 文字位置マーカー ----------

  const addCharGuide = useCallback(
    (subQuestionId: string, charGuide: ManuscriptCharGuide) =>
      dispatch({
        type: "ADD_CHAR_GUIDE",
        payload: { subQuestionId, charGuide },
      }),
    [dispatch]
  )

  const updateCharGuide = useCallback(
    (charGuideId: string, data: Partial<AsbCharGuideAttributes>) =>
      dispatch({ type: "UPDATE_CHAR_GUIDE", payload: { charGuideId, data } }),
    [dispatch]
  )

  const deleteCharGuide = useCallback(
    (charGuideId: string) =>
      dispatch({ type: "DELETE_CHAR_GUIDE", payload: { charGuideId } }),
    [dispatch]
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
    canUndo,
    canRedo,
    undo,
    redo,
  }
}
