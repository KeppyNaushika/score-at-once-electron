/**
 * Grade（成績算出）IPC ハンドラー
 */

import { dialog } from "electron"

import type {
  GradeCellTarget,
  GradeConstraintInput,
  GradeItemExclusionInput,
} from "../../src/types/grade.types"
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
  getGradeExportSettings,
  updateGrade,
  upsertGradeExportSettings,
} from "../lib/prisma/grade"
import {
  deleteBoundarySet,
  getBoundarySetsByGradeId,
  upsertBoundarySet,
} from "../lib/prisma/gradeBoundary"
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
  createGradeItem,
  deleteGradeItem,
  getGradeItemsByExamId,
  reorderGradeItems,
  updateGradeItem,
} from "../lib/prisma/gradeItem"
import {
  batchUpdateGradeItemExclusions,
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
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** 成績（Grade）のCRUD・生徒管理・データソース・成績算出・Excel出力・アーカイブに関するIPCチャンネルを登録する */
export function setupGradeHandlers(): void {
  // =====================================================================
  // Grade CRUD
  // =====================================================================

  registerHandler("grade:getAll", async () => {
    return getAllGrades()
  })

  registerHandler("grade:getById", async (id: string) => {
    return getGradeById(id)
  })

  registerHandler(
    "grade:create",
    async (data: {
      name: string
      description?: string
      referenceDate?: string | null
    }) => {
      return createGrade(data)
    }
  )

  registerHandler(
    "grade:update",
    async (
      id: string,
      data: {
        name?: string
        description?: string
        referenceDate?: string | null
      }
    ) => {
      return updateGrade(id, data)
    }
  )

  registerHandler("grade:delete", async (id: string) => {
    return deleteGrade(id)
  })

  registerHandler("grade:duplicate", async (id: string) => {
    return duplicateGrade(id)
  })

  registerSafeHandler("grade:getExportSettings", async (gradeId: string) => {
    const settings = await getGradeExportSettings(gradeId)
    return { success: true, settings }
  })

  registerSafeHandler(
    "grade:saveExportSettings",
    async (gradeId: string, settings: Record<string, unknown>) => {
      await upsertGradeExportSettings(gradeId, settings)
      return { success: true }
    }
  )

  // =====================================================================
  // Grade 生徒・学級管理
  // =====================================================================

  registerHandler("grade:getStudents", async (gradeId: string) => {
    return getStudentsByGradeId(gradeId)
  })

  registerHandler("grade:getClassrooms", async (gradeId: string) => {
    return getGradeClassrooms(gradeId)
  })

  registerHandler(
    "grade:getAvailableClassrooms",
    async (gradeId: string, activeOnly: boolean = true) => {
      return getAvailableClassroomsForGrade(gradeId, activeOnly)
    }
  )

  registerHandler(
    "grade:getAvailableStudents",
    async (gradeId: string, activeOnly: boolean = true) => {
      return getAvailableStudentsForGrade(gradeId, activeOnly)
    }
  )

  registerHandler(
    "grade:addStudentsFromClassroom",
    async (
      gradeId: string,
      classroomId: string,
      activeOnly: boolean = true
    ) => {
      return addStudentsFromClassroomToGrade(gradeId, classroomId, activeOnly)
    }
  )

  registerHandler(
    "grade:addStudentsToGrade",
    async (gradeId: string, studentIds: string[]) => {
      return addStudentsToGrade(gradeId, studentIds)
    }
  )

  registerHandler(
    "grade:removeClassroom",
    async (
      gradeId: string,
      classroomId: string,
      deleteStudents: boolean = true
    ) => {
      return removeClassroomFromGrade(gradeId, classroomId, deleteStudents)
    }
  )

  registerHandler(
    "grade:classroomRemovalPreview",
    async (gradeId: string, classroomId: string) => {
      return getGradeClassroomRemovalPreview(gradeId, classroomId)
    }
  )

  registerHandler(
    "grade:setClassroomOrders",
    async (gradeId: string, orderedClassroomIds: string[]) => {
      return setGradeClassroomOrders(gradeId, orderedClassroomIds)
    }
  )

  registerHandler(
    "grade:updateStudentOrders",
    async (
      gradeId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      return updateGradeStudentOrders(gradeId, studentOrders)
    }
  )

  // =====================================================================
  // GradeItem
  // =====================================================================

  registerHandler("grade:getGradeItems", async (gradeId: string) => {
    return getGradeItemsByExamId(gradeId)
  })

  registerHandler(
    "grade:createGradeItem",
    async (data: { gradeId: string; name: string }) => {
      return createGradeItem(data)
    }
  )

  registerHandler(
    "grade:updateGradeItem",
    async (id: string, data: { name?: string }) => {
      return updateGradeItem(id, data)
    }
  )

  registerHandler("grade:deleteGradeItem", async (id: string) => {
    return deleteGradeItem(id)
  })

  registerHandler(
    "grade:reorderGradeItems",
    async (items: { id: string; order: number }[]) => {
      return reorderGradeItems(items)
    }
  )

  // =====================================================================
  // GradeDataSource
  // =====================================================================

  registerHandler(
    "grade:createDataSource",
    async (data: {
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
    }
  )

  registerHandler(
    "grade:updateDataSource",
    async (
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
    }
  )

  registerHandler("grade:deleteDataSource", async (id: string) => {
    return deleteDataSource(id)
  })

  registerHandler(
    "grade:reorderDataSources",
    async (items: { id: string; order: number }[]) => {
      return reorderDataSources(items)
    }
  )

  // =====================================================================
  // 補助: 候補取得・計算
  // =====================================================================

  registerHandler("grade:getExamCandidates", async () => {
    return getExamCandidates()
  })

  registerHandler("grade:getExamSubtotalGroups", async (examId: string) => {
    return getExamSubtotalGroups(examId)
  })

  registerHandler("grade:getExamCropRegions", async (examId: string) => {
    return getExamCropRegions(examId)
  })

  // =====================================================================
  // GradeBoundary
  // =====================================================================

  registerHandler("grade:getBoundarySets", async (gradeId: string) => {
    return getBoundarySetsByGradeId(gradeId)
  })

  registerHandler(
    "grade:upsertBoundarySet",
    async (data: {
      gradeId: string
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => {
      return upsertBoundarySet(data)
    }
  )

  registerHandler("grade:deleteBoundarySet", async (id: string) => {
    return deleteBoundarySet(id)
  })

  // =====================================================================
  // GradeOverride
  // =====================================================================

  registerHandler(
    "grade:upsertGradeOverride",
    async (data: GradeCellTarget & { overrideLabel: string }) => {
      return upsertGradeOverride(data)
    }
  )

  registerHandler(
    "grade:deleteGradeOverride",
    async (target: GradeCellTarget) => {
      return deleteGradeOverride(target)
    }
  )

  // =====================================================================
  // GradeConstraint（観点間の制約ルール）
  // =====================================================================

  registerHandler("grade:getGradeConstraints", async (gradeId: string) => {
    return getGradeConstraints(gradeId)
  })

  registerHandler(
    "grade:createGradeConstraint",
    async (data: { gradeId: string; constraint: GradeConstraintInput }) => {
      return createGradeConstraint(data)
    }
  )

  registerHandler(
    "grade:updateGradeConstraint",
    async (data: { id: string; constraint: Partial<GradeConstraintInput> }) => {
      return updateGradeConstraint(data)
    }
  )

  registerHandler("grade:deleteGradeConstraint", async (id: string) => {
    return deleteGradeConstraint(id)
  })

  // =====================================================================
  // GradeItemExclusion
  // =====================================================================

  registerHandler("grade:getGradeItemExclusions", async (gradeId: string) => {
    return getGradeItemExclusions(gradeId)
  })

  registerHandler(
    "grade:setGradeItemExclusion",
    async (input: GradeItemExclusionInput) => {
      return setGradeItemExclusion(input)
    }
  )

  registerHandler(
    "grade:batchUpdateGradeItemExclusions",
    async (updates: GradeItemExclusionInput[]) => {
      return batchUpdateGradeItemExclusions(updates)
    }
  )

  // =====================================================================
  // 成績算出
  // =====================================================================

  registerHandler("grade:calculateGrades", async (gradeId: string) => {
    return calculateGrades(gradeId)
  })

  registerHandler("grade:computeSourceFits", async (gradeId: string) => {
    return computeSourceFits(gradeId)
  })

  // =====================================================================
  // 成績値の確定（凍結）
  // =====================================================================

  // targets 未指定は Grade 全体の一括確定・一括解除。
  registerHandler(
    "grade:freezeGradeScores",
    async (data: {
      gradeId: string
      targets?: GradeCellTarget[]
      frozenByUserId?: string | null
    }) => {
      return freezeGradeScores(data)
    }
  )

  registerHandler(
    "grade:unfreezeGradeScores",
    async (data: {
      gradeId: string
      targets?: GradeCellTarget[]
      userId?: string | null
    }) => {
      return unfreezeGradeScores(data)
    }
  )

  // =====================================================================
  // Excel出力
  // =====================================================================

  registerHandler(
    "grade:exportExcel",
    async (gradeId: string, options?: { studentIds?: string[] }) => {
      return exportGradeExcel(gradeId, {
        studentIds: options?.studentIds,
      })
    }
  )

  // =====================================================================
  // アーカイブ Export/Import
  // =====================================================================

  registerHandler("grade:exportArchive", async (gradeId: string) => {
    const result = await dialog.showSaveDialog({
      title: "成績アーカイブの保存先",
      defaultPath: `grade-exam.grade`,
      filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, error: "キャンセルされました" }
    }
    return createGradeArchive(gradeId, result.filePath)
  })

  registerHandler("grade:importArchive", async () => {
    const result = await dialog.showOpenDialog({
      title: "成績アーカイブを選択",
      filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
      properties: ["openFile"],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: "キャンセルされました" }
    }

    const extractResult = await extractGradeArchive(result.filePaths[0])
    if (!extractResult.success || !extractResult.data) {
      return extractResult
    }

    const preview = await previewGradeArchiveImport(extractResult.data)
    return { success: true, preview, archiveData: extractResult.data }
  })

  registerHandler(
    "grade:executeImport",
    async (
      archiveData: Parameters<typeof importGradeArchive>[0],
      options?: Parameters<typeof importGradeArchive>[1]
    ) => {
      return importGradeArchive(archiveData, options)
    }
  )
}
