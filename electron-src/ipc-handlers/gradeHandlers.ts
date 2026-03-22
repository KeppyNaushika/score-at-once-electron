/**
 * Grade（成績算出）IPC ハンドラー
 */

import { dialog } from "electron"

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

  registerHandler("grade:getClasses", async (gradeId: string) => {
    return getGradeClasses(gradeId)
  })

  registerHandler("grade:getAvailableClasses", async (gradeId: string) => {
    return getAvailableClassesForGrade(gradeId)
  })

  registerHandler(
    "grade:addStudentsFromClass",
    async (gradeId: string, classId: string) => {
      return addStudentsFromClassToGrade(gradeId, classId)
    }
  )

  registerHandler(
    "grade:removeClass",
    async (gradeId: string, classId: string) => {
      return removeClassFromGrade(gradeId, classId)
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
      name: string
      maxScore: number
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

  registerHandler("grade:deleteDataSource", async (id: string) => {
    return deleteDataSource(id)
  })

  registerHandler(
    "grade:reorderDataSources",
    async (items: { id: string; order: number }[]) => {
      return reorderDataSources(items)
    }
  )

  registerHandler(
    "grade:batchUpdateAbsentPolicy",
    async (
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

  registerHandler("grade:getExamCandidates", async () => {
    return getExamCandidates()
  })

  registerHandler("grade:getExamSubtotalGroups", async (examId: string) => {
    return getExamSubtotalGroups(examId)
  })

  registerHandler("grade:getExamCropRegions", async (examId: string) => {
    return getExamCropRegions(examId)
  })

  registerHandler(
    "grade:calculateSourceMaxScore",
    async (data: {
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
    }) => {
      return calculateSourceMaxScore(data)
    }
  )

  // =====================================================================
  // ManualScore
  // =====================================================================

  registerHandler(
    "grade:getManualScores",
    async (gradeDataSourceId: string) => {
      return getManualScoresByDataSourceId(gradeDataSourceId)
    }
  )

  registerHandler(
    "grade:batchUpsertManualScores",
    async (
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

  registerHandler("grade:getBoundarySets", async (gradeId: string) => {
    return getBoundarySetsByGradeId(gradeId)
  })

  registerHandler(
    "grade:upsertBoundarySet",
    async (data: {
      gradeId: string
      targetType: string
      gradeItemId: string | null
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
    async (data: {
      gradeId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
      overrideLabel: string
    }) => {
      return upsertGradeOverride(data)
    }
  )

  registerHandler(
    "grade:deleteGradeOverride",
    async (data: {
      gradeId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
    }) => {
      return deleteGradeOverride(data)
    }
  )

  // =====================================================================
  // GradeItemExclusion
  // =====================================================================

  registerHandler("grade:getGradeItemExclusions", async (gradeId: string) => {
    return getGradeItemExclusions(gradeId)
  })

  registerHandler(
    "grade:setGradeItemExclusion",
    async (data: {
      gradeId: string
      studentId: string
      gradeItemId: string
      excluded: boolean
    }) => {
      return setGradeItemExclusion(data)
    }
  )

  registerHandler(
    "grade:batchUpdateGradeItemExclusions",
    async (
      gradeId: string,
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) => {
      return batchUpdateGradeItemExclusions(gradeId, updates)
    }
  )

  // =====================================================================
  // 成績算出
  // =====================================================================

  registerHandler("grade:calculateGrades", async (gradeId: string) => {
    return calculateGrades(gradeId)
  })

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
      examMapping?: Record<string, string>
    ) => {
      return importGradeArchive(archiveData, examMapping)
    }
  )
}
