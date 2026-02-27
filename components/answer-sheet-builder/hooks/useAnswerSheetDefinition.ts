/**
 * 解答用紙定義のuseReducer状態管理
 */

import { useCallback } from "react"

import type {
  AnswerSheetAction,
  AnswerSheetDefinition,
  BranchQuestion,
  GlobalSettings,
  MajorQuestion,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"

import {
  createDefaultBranchQuestion,
  createDefaultDefinition,
  createDefaultMajorQuestion,
  createDefaultSubQuestion,
  getCircledNumber,
} from "../constants"
import { useUndoableReducer } from "./useUndoableReducer"

function reducer(
  state: AnswerSheetDefinition,
  action: AnswerSheetAction
): AnswerSheetDefinition {
  switch (action.type) {
    case "SET_DEFINITION":
      return action.payload

    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    case "SET_NAME":
      return { ...state, name: action.payload }

    case "SET_RENDER_MODE":
      return { ...state, renderMode: action.payload }

    case "ADD_MAJOR_QUESTION": {
      const nextLabel = String(state.majorQuestions.length + 1)
      return {
        ...state,
        majorQuestions: [
          ...state.majorQuestions,
          createDefaultMajorQuestion(nextLabel),
        ],
      }
    }

    case "UPDATE_MAJOR_QUESTION": {
      const { index, data } = action.payload
      const majorQuestions = [...state.majorQuestions]
      majorQuestions[index] = { ...majorQuestions[index], ...data }
      return { ...state, majorQuestions }
    }

    case "DELETE_MAJOR_QUESTION": {
      const majorQuestions = state.majorQuestions.filter(
        (_, i) => i !== action.payload.index
      )
      return { ...state, majorQuestions }
    }

    case "REORDER_MAJOR_QUESTIONS": {
      const { fromIndex, toIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const [moved] = majorQuestions.splice(fromIndex, 1)
      majorQuestions.splice(toIndex, 0, moved)
      return { ...state, majorQuestions }
    }

    case "ADD_SUB_QUESTION": {
      const { majorIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const nextLabel = getCircledNumber(major.subQuestions.length + 1)
      major.subQuestions = [
        ...major.subQuestions,
        createDefaultSubQuestion(nextLabel),
      ]
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "UPDATE_SUB_QUESTION": {
      const { majorIndex, subIndex, data } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const subs = [...major.subQuestions]
      subs[subIndex] = { ...subs[subIndex], ...data }
      major.subQuestions = subs
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "DELETE_SUB_QUESTION": {
      const { majorIndex, subIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      major.subQuestions = major.subQuestions.filter((_, i) => i !== subIndex)
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "ADD_BRANCH_QUESTION": {
      const { majorIndex, subIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const subs = [...major.subQuestions]
      const sub = { ...subs[subIndex] }
      const branchLabels = [
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
      const nextLabel =
        branchLabels[sub.branchQuestions.length] ??
        `(${sub.branchQuestions.length + 1})`
      sub.branchQuestions = [
        ...sub.branchQuestions,
        createDefaultBranchQuestion(nextLabel),
      ]
      subs[subIndex] = sub
      major.subQuestions = subs
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "UPDATE_BRANCH_QUESTION": {
      const { majorIndex, subIndex, branchIndex, data } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const subs = [...major.subQuestions]
      const sub = { ...subs[subIndex] }
      const branches = [...sub.branchQuestions]
      branches[branchIndex] = { ...branches[branchIndex], ...data }
      sub.branchQuestions = branches
      subs[subIndex] = sub
      major.subQuestions = subs
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "DELETE_BRANCH_QUESTION": {
      const { majorIndex, subIndex, branchIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const subs = [...major.subQuestions]
      const sub = { ...subs[subIndex] }
      sub.branchQuestions = sub.branchQuestions.filter(
        (_, i) => i !== branchIndex
      )
      subs[subIndex] = sub
      major.subQuestions = subs
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    default:
      return state
  }
}

export function useAnswerSheetDefinition(initial?: AnswerSheetDefinition) {
  const {
    state: definition,
    dispatch,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useUndoableReducer(reducer, initial ?? createDefaultDefinition())

  const updateSettings = useCallback(
    (settings: Partial<GlobalSettings>) =>
      dispatch({ type: "UPDATE_SETTINGS", payload: settings }),
    [dispatch]
  )

  const setName = useCallback(
    (name: string) => dispatch({ type: "SET_NAME", payload: name }),
    [dispatch]
  )

  const addMajorQuestion = useCallback(
    () => dispatch({ type: "ADD_MAJOR_QUESTION" }),
    [dispatch]
  )

  const updateMajorQuestion = useCallback(
    (index: number, data: Partial<MajorQuestion>) =>
      dispatch({ type: "UPDATE_MAJOR_QUESTION", payload: { index, data } }),
    [dispatch]
  )

  const deleteMajorQuestion = useCallback(
    (index: number) =>
      dispatch({ type: "DELETE_MAJOR_QUESTION", payload: { index } }),
    [dispatch]
  )

  const addSubQuestion = useCallback(
    (majorIndex: number) =>
      dispatch({ type: "ADD_SUB_QUESTION", payload: { majorIndex } }),
    [dispatch]
  )

  const updateSubQuestion = useCallback(
    (majorIndex: number, subIndex: number, data: Partial<SubQuestion>) =>
      dispatch({
        type: "UPDATE_SUB_QUESTION",
        payload: { majorIndex, subIndex, data },
      }),
    [dispatch]
  )

  const deleteSubQuestion = useCallback(
    (majorIndex: number, subIndex: number) =>
      dispatch({
        type: "DELETE_SUB_QUESTION",
        payload: { majorIndex, subIndex },
      }),
    [dispatch]
  )

  const addBranchQuestion = useCallback(
    (majorIndex: number, subIndex: number) =>
      dispatch({
        type: "ADD_BRANCH_QUESTION",
        payload: { majorIndex, subIndex },
      }),
    [dispatch]
  )

  const updateBranchQuestion = useCallback(
    (
      majorIndex: number,
      subIndex: number,
      branchIndex: number,
      data: Partial<BranchQuestion>
    ) =>
      dispatch({
        type: "UPDATE_BRANCH_QUESTION",
        payload: { majorIndex, subIndex, branchIndex, data },
      }),
    [dispatch]
  )

  const deleteBranchQuestion = useCallback(
    (majorIndex: number, subIndex: number, branchIndex: number) =>
      dispatch({
        type: "DELETE_BRANCH_QUESTION",
        payload: { majorIndex, subIndex, branchIndex },
      }),
    [dispatch]
  )

  const setDefinition = useCallback(
    (def: AnswerSheetDefinition) =>
      dispatch({ type: "SET_DEFINITION", payload: def }),
    [dispatch]
  )

  return {
    definition,
    dispatch,
    setDefinition,
    setName,
    updateSettings,
    addMajorQuestion,
    updateMajorQuestion,
    deleteMajorQuestion,
    addSubQuestion,
    updateSubQuestion,
    deleteSubQuestion,
    addBranchQuestion,
    updateBranchQuestion,
    deleteBranchQuestion,
    canUndo,
    canRedo,
    undo,
    redo,
  }
}
