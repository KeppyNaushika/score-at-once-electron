/**
 * 解答用紙定義のuseReducer状態管理
 */

import { useCallback } from "react"

import type {
  AnswerSheetAction,
  AnswerSheetDefinition,
  BranchQuestion,
  GlobalSettings,
  HeaderFieldDefinition,
  LabelPresets,
  MajorQuestion,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import {
  createDefaultBranchQuestion,
  createDefaultDefinition,
  createDefaultHeaderField,
  createDefaultMajorQuestion,
  createDefaultSubQuestion,
  getCircledNumber,
  parsePresetLabels,
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
      const idx = state.majorQuestions.length
      let nextLabel: string
      if (state.labelPresets?.major) {
        const labels = parsePresetLabels(state.labelPresets.major)
        nextLabel = labels[idx] ?? String(idx + 1)
      } else {
        nextLabel = String(idx + 1)
      }
      let firstSubLabel: string | undefined
      if (state.labelPresets?.sub) {
        const subLabels = parsePresetLabels(state.labelPresets.sub)
        firstSubLabel = subLabels[0]
      }
      return {
        ...state,
        majorQuestions: [
          ...state.majorQuestions,
          createDefaultMajorQuestion(nextLabel, firstSubLabel),
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
      const idx = major.subQuestions.length
      let nextLabel: string
      if (state.labelPresets?.sub) {
        const labels = parsePresetLabels(state.labelPresets.sub)
        nextLabel = labels[idx] ?? getCircledNumber(idx + 1)
      } else {
        nextLabel = getCircledNumber(idx + 1)
      }
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
      // goUp/break 相互排他
      if (data.goUp != null && subIndex > 0) {
        // goUp をセット → 前の小問の break を解除
        const prev = subs[subIndex - 1]
        if (prev.nextPlacement === "break") {
          subs[subIndex - 1] = { ...prev, nextPlacement: undefined }
        }
      }
      if (data.nextPlacement === "break" && subIndex < subs.length - 1) {
        // break をセット → 次の小問の goUp を解除
        const next = subs[subIndex + 1]
        if (next.goUp != null) {
          subs[subIndex + 1] = { ...next, goUp: undefined }
        }
      }
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
      const idx = sub.branchQuestions.length
      const defaultBranchLabels = [
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
      let nextLabel: string
      if (state.labelPresets?.branch) {
        const labels = parsePresetLabels(state.labelPresets.branch)
        nextLabel = labels[idx] ?? `(${idx + 1})`
      } else {
        nextLabel = defaultBranchLabels[idx] ?? `(${idx + 1})`
      }
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
      // goUp/break 相互排他
      if (data.goUp != null && branchIndex > 0) {
        const prev = branches[branchIndex - 1]
        if (prev.nextPlacement === "break") {
          branches[branchIndex - 1] = { ...prev, nextPlacement: undefined }
        }
      }
      if (data.nextPlacement === "break" && branchIndex < branches.length - 1) {
        const next = branches[branchIndex + 1]
        if (next.goUp != null) {
          branches[branchIndex + 1] = { ...next, goUp: undefined }
        }
      }
      sub.branchQuestions = branches
      subs[subIndex] = sub
      major.subQuestions = subs
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "REORDER_SUB_QUESTIONS": {
      const { majorIndex, fromIndex, toIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const subs = [...major.subQuestions]
      const [moved] = subs.splice(fromIndex, 1)
      subs.splice(toIndex, 0, moved)
      major.subQuestions = subs
      majorQuestions[majorIndex] = major
      return { ...state, majorQuestions }
    }

    case "REORDER_BRANCH_QUESTIONS": {
      const { majorIndex, subIndex, fromIndex, toIndex } = action.payload
      const majorQuestions = [...state.majorQuestions]
      const major = { ...majorQuestions[majorIndex] }
      const subs = [...major.subQuestions]
      const sub = { ...subs[subIndex] }
      const branches = [...sub.branchQuestions]
      const [moved] = branches.splice(fromIndex, 1)
      branches.splice(toIndex, 0, moved)
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

    case "SET_LABEL_PRESET": {
      const { category, preset } = action.payload
      const newPresets: LabelPresets = {
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
      return { ...state, labelPresets: newPresets, majorQuestions }
    }

    case "ADD_HEADER_FIELD": {
      const fields = [...state.settings.headerFields]
      const newField = createDefaultHeaderField({
        ...action.payload,
        order: fields.length,
      })
      fields.push(newField)
      return {
        ...state,
        settings: { ...state.settings, headerFields: fields },
      }
    }

    case "UPDATE_HEADER_FIELD": {
      const { fieldId, data } = action.payload
      const fields = state.settings.headerFields.map((field) =>
        field.id === fieldId ? { ...field, ...data } : field
      )
      return {
        ...state,
        settings: { ...state.settings, headerFields: fields },
      }
    }

    case "DELETE_HEADER_FIELD": {
      const fields = state.settings.headerFields
        .filter((field) => field.id !== action.payload.fieldId)
        .map((field, i) => ({ ...field, order: i }))
      return {
        ...state,
        settings: { ...state.settings, headerFields: fields },
      }
    }

    case "REORDER_HEADER_FIELDS": {
      const { fromIndex, toIndex } = action.payload
      const fields = [...state.settings.headerFields]
      const [moved] = fields.splice(fromIndex, 1)
      fields.splice(toIndex, 0, moved)
      const reordered = fields.map((field, i) => ({ ...field, order: i }))
      return {
        ...state,
        settings: { ...state.settings, headerFields: reordered },
      }
    }

    default:
      return state
  }
}

/** 解答用紙定義のCRUD操作とUndo/Redo対応の状態管理を提供するフック */
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

  const reorderMajorQuestions = useCallback(
    (fromIndex: number, toIndex: number) =>
      dispatch({
        type: "REORDER_MAJOR_QUESTIONS",
        payload: { fromIndex, toIndex },
      }),
    [dispatch]
  )

  const reorderSubQuestions = useCallback(
    (majorIndex: number, fromIndex: number, toIndex: number) =>
      dispatch({
        type: "REORDER_SUB_QUESTIONS",
        payload: { majorIndex, fromIndex, toIndex },
      }),
    [dispatch]
  )

  const reorderBranchQuestions = useCallback(
    (
      majorIndex: number,
      subIndex: number,
      fromIndex: number,
      toIndex: number
    ) =>
      dispatch({
        type: "REORDER_BRANCH_QUESTIONS",
        payload: { majorIndex, subIndex, fromIndex, toIndex },
      }),
    [dispatch]
  )

  const setDefinition = useCallback(
    (def: AnswerSheetDefinition) =>
      dispatch({ type: "SET_DEFINITION", payload: def }),
    [dispatch]
  )

  const setLabelPreset = useCallback(
    (category: "major" | "sub" | "branch", preset: string) =>
      dispatch({ type: "SET_LABEL_PRESET", payload: { category, preset } }),
    [dispatch]
  )

  const addHeaderField = useCallback(
    (defaults?: Partial<HeaderFieldDefinition>) =>
      dispatch({ type: "ADD_HEADER_FIELD", payload: defaults }),
    [dispatch]
  )

  const updateHeaderField = useCallback(
    (fieldId: string, data: Partial<HeaderFieldDefinition>) =>
      dispatch({ type: "UPDATE_HEADER_FIELD", payload: { fieldId, data } }),
    [dispatch]
  )

  const deleteHeaderField = useCallback(
    (fieldId: string) =>
      dispatch({ type: "DELETE_HEADER_FIELD", payload: { fieldId } }),
    [dispatch]
  )

  const reorderHeaderFields = useCallback(
    (fromIndex: number, toIndex: number) =>
      dispatch({
        type: "REORDER_HEADER_FIELDS",
        payload: { fromIndex, toIndex },
      }),
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
    reorderMajorQuestions,
    reorderSubQuestions,
    reorderBranchQuestions,
    setLabelPreset,
    addHeaderField,
    updateHeaderField,
    deleteHeaderField,
    reorderHeaderFields,
    canUndo,
    canRedo,
    undo,
    redo,
  }
}
