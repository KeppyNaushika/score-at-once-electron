/**
 * Grade（成績算出）IPC ハンドラー
 */

import { dialog, ipcMain } from "electron"

import { createGradeArchive } from "../lib/export/grade-archive"
import { exportGradeExcel } from "../lib/export/gradeExcel"
import {
  extractGradeArchive,
  importGradeArchive,
  previewGradeArchiveImport,
} from "../lib/import/grade-archive"
import {
  createGrade,
  deleteGrade,
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
  batchUpdateAbsentPolicy,
  calculateSourceMaxScore,
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
  addStudentsFromClassToGrade,
  getAvailableClassesForGrade,
  getGradeClasses,
  getStudentsByGradeId,
  removeClassFromGrade,
  updateGradeStudentOrders,
} from "../lib/prisma/gradeStudent"
import {
  batchUpsertManualScores,
  getManualScoresByDataSourceId,
} from "../lib/prisma/manualScore"
import { calculateGrades } from "../lib/shared/calculations/gradeCalculator"

export function setupGradeHandlers(): void {
  // =====================================================================
  // Grade CRUD
  // =====================================================================

  ipcMain.handle("grade:getAll", async () => {
    return getAllGrades()
  })

  ipcMain.handle("grade:getById", async (_event, id: string) => {
    return getGradeById(id)
  })

  ipcMain.handle(
    "grade:create",
    async (
      _event,
      data: {
        name: string
        description?: string
        referenceDate?: string | null
      }
    ) => {
      return createGrade(data)
    }
  )

  ipcMain.handle(
    "grade:update",
    async (
      _event,
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

  ipcMain.handle("grade:delete", async (_event, id: string) => {
    return deleteGrade(id)
  })

  ipcMain.handle("grade:getExportSettings", async (_event, gradeId: string) => {
    try {
      const settings = await getGradeExportSettings(gradeId)
      return { success: true, settings }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  })

  ipcMain.handle(
    "grade:saveExportSettings",
    async (_event, gradeId: string, settings: Record<string, unknown>) => {
      try {
        await upsertGradeExportSettings(gradeId, settings)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }
  )

  // =====================================================================
  // Grade 生徒・学級管理
  // =====================================================================

  ipcMain.handle("grade:getStudents", async (_event, gradeId: string) => {
    return getStudentsByGradeId(gradeId)
  })

  ipcMain.handle("grade:getClasses", async (_event, gradeId: string) => {
    return getGradeClasses(gradeId)
  })

  ipcMain.handle(
    "grade:getAvailableClasses",
    async (_event, gradeId: string) => {
      return getAvailableClassesForGrade(gradeId)
    }
  )

  ipcMain.handle(
    "grade:addStudentsFromClass",
    async (_event, gradeId: string, classId: string) => {
      return addStudentsFromClassToGrade(gradeId, classId)
    }
  )

  ipcMain.handle(
    "grade:removeClass",
    async (_event, gradeId: string, classId: string) => {
      return removeClassFromGrade(gradeId, classId)
    }
  )

  ipcMain.handle(
    "grade:updateStudentOrders",
    async (
      _event,
      gradeId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      return updateGradeStudentOrders(gradeId, studentOrders)
    }
  )

  // =====================================================================
  // GradeItem
  // =====================================================================

  ipcMain.handle("grade:getGradeItems", async (_event, gradeId: string) => {
    return getGradeItemsByExamId(gradeId)
  })

  ipcMain.handle(
    "grade:createGradeItem",
    async (_event, data: { gradeId: string; name: string }) => {
      return createGradeItem(data)
    }
  )

  ipcMain.handle(
    "grade:updateGradeItem",
    async (_event, id: string, data: { name?: string }) => {
      return updateGradeItem(id, data)
    }
  )

  ipcMain.handle("grade:deleteGradeItem", async (_event, id: string) => {
    return deleteGradeItem(id)
  })

  ipcMain.handle(
    "grade:reorderGradeItems",
    async (_event, items: { id: string; order: number }[]) => {
      return reorderGradeItems(items)
    }
  )

  // =====================================================================
  // GradeDataSource
  // =====================================================================

  ipcMain.handle(
    "grade:createDataSource",
    async (
      _event,
      data: {
        gradeItemId: string
        type: string
        examId?: string
        subtotalId?: string
        cropRegionId?: string
        name: string
        maxScore: number
        weight: number
        absentMethod?: string
        absentRatio?: number
        absentOffset?: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => {
      return createDataSource(data)
    }
  )

  ipcMain.handle(
    "grade:updateDataSource",
    async (
      _event,
      id: string,
      data: {
        name?: string
        maxScore?: number
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

  ipcMain.handle("grade:deleteDataSource", async (_event, id: string) => {
    return deleteDataSource(id)
  })

  ipcMain.handle(
    "grade:reorderDataSources",
    async (_event, items: { id: string; order: number }[]) => {
      return reorderDataSources(items)
    }
  )

  ipcMain.handle(
    "grade:batchUpdateAbsentPolicy",
    async (
      _event,
      dataSourceIds: string[],
      policy: {
        absentMethod: string
        absentRatio: number
        absentOffset: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => {
      return batchUpdateAbsentPolicy(dataSourceIds, policy)
    }
  )

  // =====================================================================
  // 補助: 候補取得・計算
  // =====================================================================

  ipcMain.handle("grade:getExamCandidates", async () => {
    return getExamCandidates()
  })

  ipcMain.handle(
    "grade:getExamSubtotalGroups",
    async (_event, examId: string) => {
      return getExamSubtotalGroups(examId)
    }
  )

  ipcMain.handle("grade:getExamCropRegions", async (_event, examId: string) => {
    return getExamCropRegions(examId)
  })

  ipcMain.handle(
    "grade:calculateSourceMaxScore",
    async (
      _event,
      data: {
        type: string
        examId?: string
        subtotalId?: string
        cropRegionId?: string
      }
    ) => {
      return calculateSourceMaxScore(data)
    }
  )

  // =====================================================================
  // ManualScore
  // =====================================================================

  ipcMain.handle(
    "grade:getManualScores",
    async (_event, gradeDataSourceId: string) => {
      return getManualScoresByDataSourceId(gradeDataSourceId)
    }
  )

  ipcMain.handle(
    "grade:batchUpsertManualScores",
    async (
      _event,
      scores: {
        gradeDataSourceId: string
        studentId: string
        score: number | null
      }[]
    ) => {
      return batchUpsertManualScores(scores)
    }
  )

  // =====================================================================
  // GradeBoundary
  // =====================================================================

  ipcMain.handle("grade:getBoundarySets", async (_event, gradeId: string) => {
    return getBoundarySetsByGradeId(gradeId)
  })

  ipcMain.handle(
    "grade:upsertBoundarySet",
    async (
      _event,
      data: {
        gradeId: string
        targetType: string
        gradeItemId: string | null
        boundaries: { label: string; minPercentage: number; order: number }[]
      }
    ) => {
      return upsertBoundarySet(data)
    }
  )

  ipcMain.handle("grade:deleteBoundarySet", async (_event, id: string) => {
    return deleteBoundarySet(id)
  })

  // =====================================================================
  // GradeOverride
  // =====================================================================

  ipcMain.handle(
    "grade:upsertGradeOverride",
    async (
      _event,
      data: {
        gradeId: string
        studentId: string
        targetType: string
        gradeItemId: string | null
        overrideLabel: string
      }
    ) => {
      return upsertGradeOverride(data)
    }
  )

  ipcMain.handle(
    "grade:deleteGradeOverride",
    async (
      _event,
      data: {
        gradeId: string
        studentId: string
        targetType: string
        gradeItemId: string | null
      }
    ) => {
      return deleteGradeOverride(data)
    }
  )

  // =====================================================================
  // GradeItemExclusion
  // =====================================================================

  ipcMain.handle(
    "grade:getGradeItemExclusions",
    async (_event, gradeId: string) => {
      return getGradeItemExclusions(gradeId)
    }
  )

  ipcMain.handle(
    "grade:setGradeItemExclusion",
    async (
      _event,
      data: {
        gradeId: string
        studentId: string
        gradeItemId: string
        excluded: boolean
      }
    ) => {
      return setGradeItemExclusion(data)
    }
  )

  ipcMain.handle(
    "grade:batchUpdateGradeItemExclusions",
    async (
      _event,
      gradeId: string,
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) => {
      return batchUpdateGradeItemExclusions(gradeId, updates)
    }
  )

  // =====================================================================
  // 成績算出
  // =====================================================================

  ipcMain.handle("grade:calculateGrades", async (_event, gradeId: string) => {
    return calculateGrades(gradeId)
  })

  // =====================================================================
  // Excel出力
  // =====================================================================

  ipcMain.handle(
    "grade:exportExcel",
    async (_event, gradeId: string, options?: { studentIds?: string[] }) => {
      return exportGradeExcel(gradeId, {
        studentIds: options?.studentIds,
      })
    }
  )

  // =====================================================================
  // アーカイブ Export/Import
  // =====================================================================

  ipcMain.handle("grade:exportArchive", async (_event, gradeId: string) => {
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

  ipcMain.handle("grade:importArchive", async (_event) => {
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

  ipcMain.handle(
    "grade:executeImport",
    async (
      _event,
      archiveData: Parameters<typeof importGradeArchive>[0],
      examMapping?: Record<string, string>
    ) => {
      return importGradeArchive(archiveData, examMapping)
    }
  )
}
