/**
 * 解答用紙の編集状態の reducer。
 *
 * 対象は id で指し、新しい実体は action に載って届く（作るのは呼び出し側）。
 * 木の書き換えは `definitionTree.ts` の道具を通し、触っていない枝は参照ごと残す。
 */

import type {
  AnswerSheetAction,
  AnswerSheetDefinition,
  LabelPresets,
} from "@/types/answerSheetDefinition.types"

import {
  filterKeepingIdentity,
  mapAllCellChildren,
  mapAllCharGuides,
  mapBranchQuestions,
  mapCellChildren,
  mapCharGuides,
  mapKeepingIdentity,
  mapMajorQuestions,
  mapSubQuestions,
  sortByIds,
  withHeaderFields,
} from "./definitionTree"

export function definitionReducer(
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
