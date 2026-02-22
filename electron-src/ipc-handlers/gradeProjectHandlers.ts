/**
 * GradeProject（成績算出）IPC ハンドラー
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
  deleteBoundarySet,
  getBoundarySetsByGradeProjectId,
  upsertBoundarySet,
} from "../lib/prisma/gradeBoundary"
import {
  batchUpdateAbsentPolicy,
  calculateSourceMaxScore,
  createDataSource,
  deleteDataSource,
  getExamProjectCandidates,
  getProjectCropRegions,
  getProjectSubtotalGroups,
  reorderDataSources,
  updateDataSource,
} from "../lib/prisma/gradeDataSource"
import {
  createGradeItem,
  deleteGradeItem,
  getGradeItemsByProjectId,
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
  createGradeProject,
  deleteGradeProject,
  getAllGradeProjects,
  getGradeProjectById,
  getGradeProjectExportSettings,
  updateGradeProject,
  upsertGradeProjectExportSettings,
} from "../lib/prisma/gradeProject"
import {
  addStudentsFromClassToGradeProject,
  getAvailableClassesForGradeProject,
  getGradeProjectClasses,
  getStudentsByGradeProjectId,
  removeClassFromGradeProject,
  updateGradeProjectStudentOrders,
} from "../lib/prisma/gradeProjectStudent"
import {
  batchUpsertManualScores,
  getManualScoresByDataSourceId,
} from "../lib/prisma/manualScore"
import { calculateGrades } from "../lib/shared/calculations/gradeCalculator"

export function setupGradeProjectHandlers(): void {
  // =====================================================================
  // GradeProject CRUD
  // =====================================================================

  ipcMain.handle("grade-project:getAll", async () => {
    return getAllGradeProjects()
  })

  ipcMain.handle("grade-project:getById", async (_event, id: string) => {
    return getGradeProjectById(id)
  })

  ipcMain.handle(
    "grade-project:create",
    async (
      _event,
      data: {
        name: string
        description?: string
        referenceDate?: string | null
      }
    ) => {
      return createGradeProject(data)
    }
  )

  ipcMain.handle(
    "grade-project:update",
    async (
      _event,
      id: string,
      data: {
        name?: string
        description?: string
        referenceDate?: string | null
      }
    ) => {
      return updateGradeProject(id, data)
    }
  )

  ipcMain.handle("grade-project:delete", async (_event, id: string) => {
    return deleteGradeProject(id)
  })

  ipcMain.handle(
    "grade-project:getExportSettings",
    async (_event, gradeProjectId: string) => {
      try {
        const settings = await getGradeProjectExportSettings(gradeProjectId)
        return { success: true, settings }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }
  )

  ipcMain.handle(
    "grade-project:saveExportSettings",
    async (
      _event,
      gradeProjectId: string,
      settings: Record<string, unknown>
    ) => {
      try {
        await upsertGradeProjectExportSettings(gradeProjectId, settings)
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
  // GradeProject 生徒・学級管理
  // =====================================================================

  ipcMain.handle(
    "grade-project:getStudents",
    async (_event, gradeProjectId: string) => {
      return getStudentsByGradeProjectId(gradeProjectId)
    }
  )

  ipcMain.handle(
    "grade-project:getClasses",
    async (_event, gradeProjectId: string) => {
      return getGradeProjectClasses(gradeProjectId)
    }
  )

  ipcMain.handle(
    "grade-project:getAvailableClasses",
    async (_event, gradeProjectId: string) => {
      return getAvailableClassesForGradeProject(gradeProjectId)
    }
  )

  ipcMain.handle(
    "grade-project:addStudentsFromClass",
    async (_event, gradeProjectId: string, classId: string) => {
      return addStudentsFromClassToGradeProject(gradeProjectId, classId)
    }
  )

  ipcMain.handle(
    "grade-project:removeClass",
    async (_event, gradeProjectId: string, classId: string) => {
      return removeClassFromGradeProject(gradeProjectId, classId)
    }
  )

  ipcMain.handle(
    "grade-project:updateStudentOrders",
    async (
      _event,
      gradeProjectId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      return updateGradeProjectStudentOrders(gradeProjectId, studentOrders)
    }
  )

  // =====================================================================
  // GradeItem
  // =====================================================================

  ipcMain.handle(
    "grade-project:getGradeItems",
    async (_event, gradeProjectId: string) => {
      return getGradeItemsByProjectId(gradeProjectId)
    }
  )

  ipcMain.handle(
    "grade-project:createGradeItem",
    async (_event, data: { gradeProjectId: string; name: string }) => {
      return createGradeItem(data)
    }
  )

  ipcMain.handle(
    "grade-project:updateGradeItem",
    async (_event, id: string, data: { name?: string }) => {
      return updateGradeItem(id, data)
    }
  )

  ipcMain.handle(
    "grade-project:deleteGradeItem",
    async (_event, id: string) => {
      return deleteGradeItem(id)
    }
  )

  ipcMain.handle(
    "grade-project:reorderGradeItems",
    async (_event, items: { id: string; order: number }[]) => {
      return reorderGradeItems(items)
    }
  )

  // =====================================================================
  // GradeDataSource
  // =====================================================================

  ipcMain.handle(
    "grade-project:createDataSource",
    async (
      _event,
      data: {
        gradeItemId: string
        type: string
        examProjectId?: string
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
    "grade-project:updateDataSource",
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

  ipcMain.handle(
    "grade-project:deleteDataSource",
    async (_event, id: string) => {
      return deleteDataSource(id)
    }
  )

  ipcMain.handle(
    "grade-project:reorderDataSources",
    async (_event, items: { id: string; order: number }[]) => {
      return reorderDataSources(items)
    }
  )

  ipcMain.handle(
    "grade-project:batchUpdateAbsentPolicy",
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

  ipcMain.handle("grade-project:getExamProjectCandidates", async () => {
    return getExamProjectCandidates()
  })

  ipcMain.handle(
    "grade-project:getProjectSubtotalGroups",
    async (_event, projectId: string) => {
      return getProjectSubtotalGroups(projectId)
    }
  )

  ipcMain.handle(
    "grade-project:getProjectCropRegions",
    async (_event, projectId: string) => {
      return getProjectCropRegions(projectId)
    }
  )

  ipcMain.handle(
    "grade-project:calculateSourceMaxScore",
    async (
      _event,
      data: {
        type: string
        examProjectId?: string
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
    "grade-project:getManualScores",
    async (_event, gradeDataSourceId: string) => {
      return getManualScoresByDataSourceId(gradeDataSourceId)
    }
  )

  ipcMain.handle(
    "grade-project:batchUpsertManualScores",
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

  ipcMain.handle(
    "grade-project:getBoundarySets",
    async (_event, gradeProjectId: string) => {
      return getBoundarySetsByGradeProjectId(gradeProjectId)
    }
  )

  ipcMain.handle(
    "grade-project:upsertBoundarySet",
    async (
      _event,
      data: {
        gradeProjectId: string
        targetType: string
        gradeItemId: string | null
        boundaries: { label: string; minPercentage: number; order: number }[]
      }
    ) => {
      return upsertBoundarySet(data)
    }
  )

  ipcMain.handle(
    "grade-project:deleteBoundarySet",
    async (_event, id: string) => {
      return deleteBoundarySet(id)
    }
  )

  // =====================================================================
  // GradeOverride
  // =====================================================================

  ipcMain.handle(
    "grade-project:upsertGradeOverride",
    async (
      _event,
      data: {
        gradeProjectId: string
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
    "grade-project:deleteGradeOverride",
    async (
      _event,
      data: {
        gradeProjectId: string
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
    "grade-project:getGradeItemExclusions",
    async (_event, gradeProjectId: string) => {
      return getGradeItemExclusions(gradeProjectId)
    }
  )

  ipcMain.handle(
    "grade-project:setGradeItemExclusion",
    async (
      _event,
      data: {
        gradeProjectId: string
        studentId: string
        gradeItemId: string
        excluded: boolean
      }
    ) => {
      return setGradeItemExclusion(data)
    }
  )

  ipcMain.handle(
    "grade-project:batchUpdateGradeItemExclusions",
    async (
      _event,
      gradeProjectId: string,
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) => {
      return batchUpdateGradeItemExclusions(gradeProjectId, updates)
    }
  )

  // =====================================================================
  // 成績算出
  // =====================================================================

  ipcMain.handle(
    "grade-project:calculateGrades",
    async (_event, gradeProjectId: string) => {
      return calculateGrades(gradeProjectId)
    }
  )

  // =====================================================================
  // Excel出力
  // =====================================================================

  ipcMain.handle(
    "grade-project:exportExcel",
    async (
      _event,
      gradeProjectId: string,
      options?: { studentIds?: string[] }
    ) => {
      return exportGradeExcel(gradeProjectId, {
        studentIds: options?.studentIds,
      })
    }
  )

  // =====================================================================
  // アーカイブ Export/Import
  // =====================================================================

  ipcMain.handle(
    "grade-project:exportArchive",
    async (_event, gradeProjectId: string) => {
      const result = await dialog.showSaveDialog({
        title: "成績アーカイブの保存先",
        defaultPath: `grade-project.grade`,
        filters: [{ name: "成績アーカイブ", extensions: ["grade"] }],
      })
      if (result.canceled || !result.filePath) {
        return { success: false, error: "キャンセルされました" }
      }
      return createGradeArchive(gradeProjectId, result.filePath)
    }
  )

  ipcMain.handle("grade-project:importArchive", async (_event) => {
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
    "grade-project:executeImport",
    async (
      _event,
      archiveData: Parameters<typeof importGradeArchive>[0],
      examProjectMapping?: Record<string, string>
    ) => {
      return importGradeArchive(archiveData, examProjectMapping)
    }
  )
}
