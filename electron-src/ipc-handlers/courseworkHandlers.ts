/**
 * Coursework（試験外成績資料）IPC ハンドラー
 */

import { dialog, ipcMain } from "electron"

import type {
  CourseworkImportDecisions,
  CourseworkMatchingMethod,
} from "../../src/types/courseworkArchive.types"
import { exportCoursework } from "../lib/export/coursework-archive"
import {
  cleanupCourseworkTempDir,
  extractCourseworkArchive,
  importCourseworkArchive,
  previewCourseworkImport,
} from "../lib/import/coursework-archive"
import {
  addStudentsFromClassToCoursework,
  addStudentsToCoursework,
  batchUpsertCourseworkScores,
  createCoursework,
  createCourseworkItem,
  deleteCoursework,
  deleteCourseworkItem,
  getAvailableClassesForCoursework,
  getAvailableStudentsForCoursework,
  getCourseworkById,
  getCourseworkCandidates,
  getCourseworkClasses,
  getCourseworks,
  getCourseworkScoresByItemId,
  getCourseworkStudents,
  removeClassFromCoursework,
  removeStudentsFromCoursework,
  reorderCourseworkItems,
  setCourseworkTags,
  updateCoursework,
  updateCourseworkItem,
  updateCourseworkStudentOrders,
} from "../lib/prisma/coursework"
import { registerHandler } from "./ipcHandlerUtils"

/** 試験外成績資料の CRUD・評価項目・点数・名簿・タグ用 IPC チャンネルを登録する */
export function setupCourseworkHandlers(): void {
  // Coursework（トップレベル）
  registerHandler("coursework:getAll", async () => {
    return getCourseworks()
  })

  registerHandler("coursework:getById", async (id: string) => {
    return getCourseworkById(id)
  })

  registerHandler(
    "coursework:create",
    async (data: {
      name: string
      description?: string | null
      date?: string | null
    }) => {
      return createCoursework(data)
    }
  )

  registerHandler(
    "coursework:update",
    async (
      id: string,
      data: { name?: string; description?: string | null; date?: string | null }
    ) => {
      return updateCoursework(id, data)
    }
  )

  registerHandler("coursework:delete", async (id: string) => {
    return deleteCoursework(id)
  })

  registerHandler("coursework:getCandidates", async () => {
    return getCourseworkCandidates()
  })

  // CourseworkItem（評価項目）
  registerHandler(
    "coursework:createItem",
    async (data: {
      courseworkId: string
      name: string
      maxScore: number
      inputMode?: string
      letterScales?: { label: string; score: number; order: number }[]
    }) => {
      return createCourseworkItem(data)
    }
  )

  registerHandler(
    "coursework:updateItem",
    async (
      id: string,
      data: {
        name?: string
        maxScore?: number
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }
    ) => {
      return updateCourseworkItem(id, data)
    }
  )

  registerHandler("coursework:deleteItem", async (id: string) => {
    return deleteCourseworkItem(id)
  })

  registerHandler(
    "coursework:reorderItems",
    async (items: { id: string; order: number }[]) => {
      return reorderCourseworkItems(items)
    }
  )

  // CourseworkScore（点数）
  registerHandler("coursework:getScores", async (courseworkItemId: string) => {
    return getCourseworkScoresByItemId(courseworkItemId)
  })

  registerHandler(
    "coursework:batchUpsertScores",
    async (
      scores: {
        courseworkItemId: string
        studentId: string
        score?: number | null
        letterValue?: string | null
        adjustment?: number | null
        adjustmentReason?: string | null
        comment?: string | null
      }[]
    ) => {
      return batchUpsertCourseworkScores(scores)
    }
  )

  // 名簿（CourseworkStudent / CourseworkClass）
  registerHandler("coursework:getStudents", async (courseworkId: string) => {
    return getCourseworkStudents(courseworkId)
  })

  registerHandler("coursework:getClasses", async (courseworkId: string) => {
    return getCourseworkClasses(courseworkId)
  })

  registerHandler(
    "coursework:getAvailableClasses",
    async (courseworkId: string, activeOnly?: boolean) => {
      return getAvailableClassesForCoursework(courseworkId, activeOnly)
    }
  )

  registerHandler(
    "coursework:getAvailableStudents",
    async (courseworkId: string, activeOnly?: boolean) => {
      return getAvailableStudentsForCoursework(courseworkId, activeOnly)
    }
  )

  registerHandler(
    "coursework:addStudentsFromClass",
    async (courseworkId: string, classId: string, activeOnly?: boolean) => {
      return addStudentsFromClassToCoursework(courseworkId, classId, activeOnly)
    }
  )

  registerHandler(
    "coursework:addStudents",
    async (courseworkId: string, studentIds: string[]) => {
      return addStudentsToCoursework(courseworkId, studentIds)
    }
  )

  registerHandler(
    "coursework:updateStudentOrders",
    async (
      courseworkId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      return updateCourseworkStudentOrders(courseworkId, studentOrders)
    }
  )

  registerHandler(
    "coursework:removeStudents",
    async (courseworkId: string, studentIds: string[]) => {
      return removeStudentsFromCoursework(courseworkId, studentIds)
    }
  )

  registerHandler(
    "coursework:removeClass",
    async (courseworkId: string, classId: string) => {
      return removeClassFromCoursework(courseworkId, classId)
    }
  )

  // タグ（CourseworkTag）
  registerHandler(
    "coursework:setTags",
    async (courseworkId: string, tagIds: string[]) => {
      return setCourseworkTags(courseworkId, tagIds)
    }
  )

  // ── アーカイブ（.coursework のエクスポート／インポート）────────────
  // エクスポート（保存ダイアログは exportCoursework 内で表示）
  registerHandler("coursework:exportArchive", async (courseworkId: string) => {
    return exportCoursework({ courseworkId })
  })

  // インポートファイル選択ダイアログ
  registerHandler("coursework:selectImportFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "試験外成績資料をインポート",
      filters: [
        { name: "試験外成績資料", extensions: ["coursework"] },
        { name: "すべてのファイル", extensions: ["*"] },
      ],
      properties: ["openFile"],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, canceled: true }
    }
    return { success: true, filePath: result.filePaths[0] }
  })

  // アーカイブ解析（プレビュー）。tempDir を finally で後始末するため手動 handle。
  ipcMain.handle(
    "coursework:analyzeArchive",
    async (_event, options: { archivePath: string }) => {
      let tempDir: string | null = null
      try {
        const ext = await extractCourseworkArchive(options.archivePath)
        if (!ext.success || !ext.data) {
          return { success: false, error: ext.error }
        }
        tempDir = ext.data.tempDir
        return await previewCourseworkImport(ext.data.data)
      } catch (error) {
        console.error(
          "Error in IPC handler [coursework:analyzeArchive]:",
          error
        )
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "アーカイブ解析に失敗しました",
        }
      } finally {
        if (tempDir) cleanupCourseworkTempDir(tempDir)
      }
    }
  )

  // インポート実行。tempDir を finally で後始末するため手動 handle。
  ipcMain.handle(
    "coursework:importArchive",
    async (
      _event,
      options: {
        archivePath: string
        courseworkDecisions?: CourseworkImportDecisions
        studentMatching?: CourseworkMatchingMethod
      }
    ) => {
      let tempDir: string | null = null
      try {
        const ext = await extractCourseworkArchive(options.archivePath)
        if (!ext.success || !ext.data) {
          return { success: false, error: ext.error }
        }
        tempDir = ext.data.tempDir
        return await importCourseworkArchive(ext.data.data, {
          courseworkDecisions: options.courseworkDecisions,
          studentMatching: options.studentMatching,
        })
      } catch (error) {
        console.error("Error in IPC handler [coursework:importArchive]:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "インポートに失敗しました",
        }
      } finally {
        if (tempDir) cleanupCourseworkTempDir(tempDir)
      }
    }
  )
}
