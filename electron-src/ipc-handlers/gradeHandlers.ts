/**
 * Grade（成績算出）IPC ハンドラー
 */

import { dialog } from "electron"

import type { ConfirmedDeletionCount } from "../../src/types/deletionConfirmation.types"
import type {
  GradeCellTarget,
  GradeConstraintInput,
  GradeItemExclusionInput,
} from "../../src/types/grade.types"
import type { GradeReportSettings } from "../../src/types/gradeReport.types"
import { createGradeArchive } from "../lib/export/grade-archive/gradeArchiveCreator"
import { exportGradeExcel } from "../lib/export/gradeExcel/gradeExcelExportMain"
import { extractGradeArchive } from "../lib/import/grade-archive/gradeArchiveExtractor"
import {
  importGradeArchive,
  previewGradeArchiveImport,
} from "../lib/import/grade-archive/gradeArchiveImporter"
import {
  createGrade,
  deleteGrade,
  duplicateGrade,
  getAllGrades,
  getGradeById,
  updateGrade,
} from "../lib/prisma/grade"
import {
  createGradeConstraint,
  deleteGradeConstraint,
  getGradeConstraints,
  updateGradeConstraint,
} from "../lib/prisma/gradeConstraint"
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
  freezeGradeScores,
  unfreezeGradeScores,
} from "../lib/prisma/gradeFrozenScore"
import {
  getGradeIndividualReportSettings,
  updateGradeIndividualReportSettings,
} from "../lib/prisma/gradeIndividualReportSettings"
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
import {
  getGradeItemExclusions,
  setGradeItemExclusion,
} from "../lib/prisma/gradeItemExclusion"
import {
  deleteGradeOverride,
  upsertGradeOverride,
} from "../lib/prisma/gradeOverride"
import {
  addStudentsFromClassroomToGrade,
  addStudentsToGrade,
  getAvailableClassroomsForGrade,
  getAvailableStudentsForGrade,
  getGradeClassroomRemovalPreview,
  getGradeClassrooms,
  getStudentsByGradeId,
  removeClassroomFromGrade,
  setGradeClassroomOrders,
  updateGradeStudentOrders,
} from "../lib/prisma/gradeStudent"
import {
  calculateGrades,
  computeSourceFits,
} from "../lib/shared/calculations/gradeCalculator"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 成績（Grade）のCRUD・生徒管理・データソース・成績算出・Excel出力・アーカイブに関するIPCチャンネルを登録する */
export const gradeHandlers = {
  // =====================================================================
  // Grade CRUD
  // =====================================================================

  "grade:getAll": async () => {
    return getAllGrades()
  },

  "grade:getById": async (id: string) => {
    return getGradeById(id)
  },

  "grade:create": async (data: {
    name: string
    description?: string
    referenceDate?: string | null
  }) => {
    return createGrade(data)
  },

  "grade:update": async (
    id: string,
    data: {
      name?: string
      description?: string | null
      referenceDate?: string | null
    }
  ) => {
    return updateGrade(id, data)
  },

  "grade:delete": async (id: string) => {
    return deleteGrade(id)
  },

  "grade:duplicate": async (id: string) => {
    return duplicateGrade(id)
  },

  "grade:getReportSettings": async (gradeId: string) => {
    return getGradeIndividualReportSettings(gradeId)
  },

  // 触った列だけを載せる。まるごと送ると、続けて2つ変えたときに先の1つが消える
  "grade:updateReportSettings": async (
    gradeId: string,
    values: Partial<GradeReportSettings>
  ) => {
    await updateGradeIndividualReportSettings(gradeId, values)
  },

  // =====================================================================
  // Grade 生徒・学級管理
  // =====================================================================

  "grade:getStudents": async (gradeId: string) => {
    return getStudentsByGradeId(gradeId)
  },

  "grade:getClassrooms": async (gradeId: string) => {
    return getGradeClassrooms(gradeId)
  },

  "grade:getAvailableClassrooms": async (
    gradeId: string,
    activeOnly: boolean = true
  ) => {
    return getAvailableClassroomsForGrade(gradeId, activeOnly)
  },

  "grade:getAvailableStudents": async (
    gradeId: string,
    activeOnly: boolean = true
  ) => {
    return getAvailableStudentsForGrade(gradeId, activeOnly)
  },

  "grade:addStudentsFromClassroom": async (
    gradeId: string,
    classroomId: string,
    activeOnly: boolean = true
  ) => {
    return addStudentsFromClassroomToGrade(gradeId, classroomId, activeOnly)
  },

  "grade:addStudentsToGrade": async (gradeId: string, studentIds: string[]) => {
    return addStudentsToGrade(gradeId, studentIds)
  },

  // 利用者が見た件数を添えて削除する（消す直前に数え直し、増えていれば中止する）
  "grade:removeClassroom": async (
    gradeId: string,
    classroomId: string,
    deleteStudents: boolean,
    confirmedCounts: ConfirmedDeletionCount[]
  ) => {
    return removeClassroomFromGrade(
      gradeId,
      classroomId,
      deleteStudents,
      confirmedCounts
    )
  },

  "grade:classroomRemovalPreview": async (
    gradeId: string,
    classroomId: string
  ) => {
    return getGradeClassroomRemovalPreview(gradeId, classroomId)
  },

  "grade:setClassroomOrders": async (
    gradeId: string,
    orderedClassroomIds: string[]
  ) => {
    return setGradeClassroomOrders(gradeId, orderedClassroomIds)
  },

  "grade:updateStudentOrders": async (
    gradeId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    return updateGradeStudentOrders(gradeId, studentOrders)
  },

  // =====================================================================
  // GradeItem
  // =====================================================================

  "grade:createGradeItem": async (data: { gradeId: string; name: string }) => {
    return createGradeItem(data)
  },

  "grade:updateGradeItem": async (id: string, data: { name?: string }) => {
    return updateGradeItem(id, data)
  },

  "grade:deleteGradeItem": async (id: string) => {
    return deleteGradeItem(id)
  },

  "grade:reorderGradeItems": async (items: { id: string; order: number }[]) => {
    return reorderGradeItems(items)
  },

  // =====================================================================
  // GradeDataSource
  // =====================================================================

  "grade:createDataSource": async (data: {
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
    return createDataSource(data)
  },

  "grade:updateDataSource": async (
    id: string,
    data: {
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
    return updateDataSource(id, data)
  },

  "grade:deleteDataSource": async (id: string) => {
    return deleteDataSource(id)
  },

  "grade:reorderDataSources": async (
    items: { id: string; order: number }[]
  ) => {
    return reorderDataSources(items)
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
  "grade:replaceGradeItemBoundaries": async (data: {
    gradeItemId: string
    boundaries: { label: string; minPercentage: number; order: number }[]
  }) => {
    return replaceGradeItemBoundaries(data)
  },

  "grade:createGradeItemBoundary": async (data: {
    gradeItemId: string
    label: string
    minPercentage: number
    order: number
  }) => {
    return createGradeItemBoundary(data)
  },

  "grade:updateGradeItemBoundary": async (data: {
    id: string
    label?: string
    minPercentage?: number
  }) => {
    const { id, ...rest } = data
    return updateGradeItemBoundary(id, rest)
  },

  "grade:deleteGradeItemBoundary": async (id: string) => {
    return deleteGradeItemBoundary(id)
  },

  "grade:reorderGradeItemBoundaries": async (
    items: { id: string; order: number }[]
  ) => {
    return reorderGradeItemBoundaries(items)
  },

  "grade:deleteGradeItemBoundaries": async (gradeItemId: string) => {
    return deleteGradeItemBoundaries(gradeItemId)
  },

  // =====================================================================
  // GradeOverride
  // =====================================================================

  "grade:upsertGradeOverride": async (
    data: GradeCellTarget & { overrideLabel: string }
  ) => {
    return upsertGradeOverride(data)
  },

  "grade:deleteGradeOverride": async (target: GradeCellTarget) => {
    return deleteGradeOverride(target)
  },

  // =====================================================================
  // GradeConstraint（観点間の制約ルール）
  // =====================================================================

  "grade:getGradeConstraints": async (gradeId: string) => {
    return getGradeConstraints(gradeId)
  },

  "grade:createGradeConstraint": async (data: {
    gradeId: string
    constraint: GradeConstraintInput
  }) => {
    return createGradeConstraint(data)
  },

  "grade:updateGradeConstraint": async (data: {
    id: string
    constraint: Partial<GradeConstraintInput>
  }) => {
    return updateGradeConstraint(data)
  },

  "grade:deleteGradeConstraint": async (id: string) => {
    return deleteGradeConstraint(id)
  },

  // =====================================================================
  // GradeItemExclusion
  // =====================================================================

  "grade:getGradeItemExclusions": async (gradeId: string) => {
    return getGradeItemExclusions(gradeId)
  },

  "grade:setGradeItemExclusion": async (input: GradeItemExclusionInput) => {
    return setGradeItemExclusion(input)
  },

  // =====================================================================
  // 成績算出
  // =====================================================================

  "grade:calculateGrades": async (gradeId: string) => {
    return calculateGrades(gradeId)
  },

  "grade:computeSourceFits": async (gradeId: string) => {
    return computeSourceFits(gradeId)
  },

  // =====================================================================
  // 成績値の確定（凍結）
  // =====================================================================

  // targets 未指定は Grade 全体の一括確定・一括解除。
  "grade:freezeGradeScores": async (data: {
    gradeId: string
    targets?: GradeCellTarget[]
    frozenByUserId?: string | null
  }) => {
    return freezeGradeScores(data)
  },

  "grade:unfreezeGradeScores": async (data: {
    gradeId: string
    targets?: GradeCellTarget[]
    userId?: string | null
  }) => {
    return unfreezeGradeScores(data)
  },

  // =====================================================================
  // Excel出力
  // =====================================================================

  "grade:exportExcel": async (
    gradeId: string,
    options?: { studentIds?: string[] }
  ) => {
    return exportGradeExcel(gradeId, {
      studentIds: options?.studentIds,
    })
  },

  // =====================================================================
  // アーカイブ Export/Import
  // =====================================================================

  "grade:exportArchive": async (gradeId: string) => {
    const result = await dialog.showSaveDialog({
      title: "成績アーカイブの保存先",
      defaultPath: `grade-exam.grade`,
      filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }
    await createGradeArchive(gradeId, result.filePath)
    return { canceled: false as const, outputPath: result.filePath }
  },

  "grade:importArchive": async () => {
    const result = await dialog.showOpenDialog({
      title: "成績アーカイブを選択",
      filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
      properties: ["openFile"],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }

    const archiveData = await extractGradeArchive(result.filePaths[0])
    const preview = await previewGradeArchiveImport(archiveData)
    return { canceled: false as const, preview, archiveData }
  },

  "grade:executeImport": async (
    archiveData: Parameters<typeof importGradeArchive>[0],
    options?: Parameters<typeof importGradeArchive>[1]
  ) => {
    return importGradeArchive(archiveData, options)
  },
} satisfies HandlerMap
