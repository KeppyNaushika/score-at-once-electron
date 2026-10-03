/**
 * 成績算出の評価項目と、その中身（データソース・評定境界・比較）の IPC ハンドラー
 */

import {
  createGradeComparison,
  deleteGradeComparison,
  getGradeComparisons,
  reorderGradeComparisons,
} from "../lib/prisma/gradeComparison"
import {
  createDataSource,
  deleteDataSource,
  getExamCandidates,
  getExamCropRegions,
  getExamSubtotalGroups,
  reorderDataSources,
  updateDataSource,
} from "../lib/prisma/gradeDataSource"
import {
  createGradeItem,
  deleteGradeItem,
  reorderGradeItems,
  updateGradeItem,
} from "../lib/prisma/gradeItem"
import {
  createGradeItemBoundary,
  deleteGradeItemBoundaries,
  deleteGradeItemBoundary,
  reorderGradeItemBoundaries,
  replaceGradeItemBoundaries,
  updateGradeItemBoundary,
} from "../lib/prisma/gradeItemBoundary"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 評価項目・データソース・評定境界・比較の IPC チャンネル */
export const gradeStructureHandlers = {
  // =====================================================================
  // GradeItem
  // =====================================================================

  "grade:createGradeItem": async (gradeItemInput: {
    gradeId: string
    name: string
  }) => {
    return createGradeItem(gradeItemInput)
  },

  "grade:updateGradeItem": async (
    id: string,
    gradeItemChanges: { name?: string }
  ) => {
    return updateGradeItem(id, gradeItemChanges)
  },

  "grade:deleteGradeItem": async (id: string) => {
    return deleteGradeItem(id)
  },

  "grade:reorderGradeItems": async (
    gradeItemOrders: { id: string; order: number }[]
  ) => {
    return reorderGradeItems(gradeItemOrders)
  },

  // =====================================================================
  // GradeDataSource
  // =====================================================================

  "grade:createDataSource": async (dataSourceInput: {
    gradeItemId: string
    type: string
    examId?: string
    subtotalId?: string
    cropRegionId?: string
    courseworkItemId?: string
    courseworkId?: string
    name: string
    weight: number
    absentMethod?: string
    absentRatio?: number
    absentOffset?: number
    treatExpectedAsMissing?: boolean
    estimationMode?: string
    estimationSourceIds?: string[]
  }) => {
    return createDataSource(dataSourceInput)
  },

  "grade:updateDataSource": async (
    id: string,
    dataSourceChanges: {
      name?: string
      weight?: number
      absentMethod?: string
      absentRatio?: number
      absentOffset?: number
      treatExpectedAsMissing?: boolean
      estimationMode?: string
      estimationSourceIds?: string[]
    }
  ) => {
    return updateDataSource(id, dataSourceChanges)
  },

  "grade:deleteDataSource": async (id: string) => {
    return deleteDataSource(id)
  },

  "grade:reorderDataSources": async (
    dataSourceOrders: { id: string; order: number }[]
  ) => {
    return reorderDataSources(dataSourceOrders)
  },

  // =====================================================================
  // 補助: 候補取得・計算
  // =====================================================================

  "grade:getExamCandidates": async () => {
    return getExamCandidates()
  },

  "grade:getExamSubtotalGroups": async (examId: string) => {
    return getExamSubtotalGroups(examId)
  },

  "grade:getExamCropRegions": async (examId: string) => {
    return getExamCropRegions(examId)
  },

  // =====================================================================
  // GradeItemBoundary
  // =====================================================================

  // 一括経路。プリセットの適用だけが使う（日常の編集は1本ずつの経路へ）
  "grade:replaceGradeItemBoundaries": async (boundaryReplacement: {
    gradeItemId: string
    boundaries: { label: string; minPercentage: number; order: number }[]
  }) => {
    return replaceGradeItemBoundaries(boundaryReplacement)
  },

  "grade:createGradeItemBoundary": async (boundaryInput: {
    gradeItemId: string
    label: string
    minPercentage: number
    order: number
  }) => {
    return createGradeItemBoundary(boundaryInput)
  },

  "grade:updateGradeItemBoundary": async ({
    id,
    ...boundaryChanges
  }: {
    id: string
    label?: string
    minPercentage?: number
  }) => {
    return updateGradeItemBoundary(id, boundaryChanges)
  },

  "grade:deleteGradeItemBoundary": async (id: string) => {
    return deleteGradeItemBoundary(id)
  },

  "grade:reorderGradeItemBoundaries": async (
    boundaryOrders: { id: string; order: number }[]
  ) => {
    return reorderGradeItemBoundaries(boundaryOrders)
  },

  "grade:deleteGradeItemBoundaries": async (gradeItemId: string) => {
    return deleteGradeItemBoundaries(gradeItemId)
  },

  // =====================================================================
  // GradeComparison
  // =====================================================================

  "grade:getComparisons": async (gradeId: string) => {
    return getGradeComparisons(gradeId)
  },

  "grade:createComparison": async (comparisonInput: {
    gradeItemId: string
    comparedGradeItemId: string
  }) => {
    return createGradeComparison(comparisonInput)
  },

  "grade:deleteComparison": async (id: string) => {
    return deleteGradeComparison(id)
  },

  "grade:reorderComparisons": async (
    comparisonOrders: { id: string; order: number }[]
  ) => {
    return reorderGradeComparisons(comparisonOrders)
  },
} satisfies HandlerMap
