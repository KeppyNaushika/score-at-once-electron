/**
 * Coursework（試験外成績資料）IPC ハンドラー
 */

import { dialog } from "electron"

import type { CourseworkScoreUpsertInput } from "../../src/types/coursework.types"
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
  addCourseworkTag,
  addStudentsFromClassroomToCoursework,
  addStudentsToCoursework,
  batchUpsertCourseworkScores,
  createCoursework,
  createCourseworkItem,
  deleteCoursework,
  deleteCourseworkItem,
  getAvailableClassroomsForCoursework,
  getAvailableStudentsForCoursework,
  getCourseworkById,
  getCourseworkCandidates,
  getCourseworkClassroomRemovalPreview,
  getCourseworkClassrooms,
  getCourseworks,
  getCourseworkScoresByItemId,
  getCourseworkStudents,
  removeClassroomFromCoursework,
  removeStudentsFromCoursework,
  reorderCourseworkItems,
  setCourseworkClassroomOrders,
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
    async (scores: CourseworkScoreUpsertInput[]) => {
      return batchUpsertCourseworkScores(scores)
    }
  )

  // 名簿（CourseworkStudent / CourseworkClassroom）
  registerHandler("coursework:getStudents", async (courseworkId: string) => {
    return getCourseworkStudents(courseworkId)
  })

  registerHandler("coursework:getClassrooms", async (courseworkId: string) => {
    return getCourseworkClassrooms(courseworkId)
  })

  registerHandler(
    "coursework:getAvailableClassrooms",
    async (courseworkId: string, activeOnly?: boolean) => {
      return getAvailableClassroomsForCoursework(courseworkId, activeOnly)
    }
  )

  registerHandler(
    "coursework:getAvailableStudents",
    async (courseworkId: string, activeOnly?: boolean) => {
      return getAvailableStudentsForCoursework(courseworkId, activeOnly)
    }
  )

  registerHandler(
    "coursework:addStudentsFromClassroom",
    async (courseworkId: string, classroomId: string, activeOnly?: boolean) => {
      return addStudentsFromClassroomToCoursework(
        courseworkId,
        classroomId,
        activeOnly
      )
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
    "coursework:removeClassroom",
    async (
      courseworkId: string,
      classroomId: string,
      deleteStudents: boolean = true
    ) => {
      return removeClassroomFromCoursework(
        courseworkId,
        classroomId,
        deleteStudents
      )
    }
  )

  registerHandler(
    "coursework:classroomRemovalPreview",
    async (courseworkId: string, classroomId: string) => {
      return getCourseworkClassroomRemovalPreview(courseworkId, classroomId)
    }
  )

  registerHandler(
    "coursework:setClassroomOrders",
    async (courseworkId: string, orderedClassroomIds: string[]) => {
      return setCourseworkClassroomOrders(courseworkId, orderedClassroomIds)
    }
  )

  // タグ（CourseworkTag）
  registerHandler(
    "coursework:setTags",
    async (courseworkId: string, tagIds: string[]) => {
      return setCourseworkTags(courseworkId, tagIds)
    }
  )

  registerHandler(
    "coursework:addTag",
    async (courseworkId: string, tagId: string) => {
      return addCourseworkTag(courseworkId, tagId)
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
      return { canceled: true }
    }
    return { canceled: false, filePath: result.filePaths[0] }
  })

  // アーカイブ解析（プレビュー）
  registerHandler(
    "coursework:analyzeArchive",
    async (options: { archivePath: string }) => {
      const extracted = await extractCourseworkArchive(options.archivePath)
      try {
        return await previewCourseworkImport(extracted.data)
      } finally {
        cleanupCourseworkTempDir(extracted.tempDir)
      }
    }
  )

  // インポート実行
  registerHandler(
    "coursework:importArchive",
    async (options: {
      archivePath: string
      courseworkDecisions?: CourseworkImportDecisions
      studentMatching?: CourseworkMatchingMethod
    }) => {
      const extracted = await extractCourseworkArchive(options.archivePath)
      try {
        return await importCourseworkArchive(extracted.data, {
          courseworkDecisions: options.courseworkDecisions,
          studentMatching: options.studentMatching,
        })
      } finally {
        cleanupCourseworkTempDir(extracted.tempDir)
      }
    }
  )
}
