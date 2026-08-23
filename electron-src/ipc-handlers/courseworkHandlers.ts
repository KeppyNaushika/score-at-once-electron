/**
 * Coursework（試験外成績資料）IPC ハンドラー
 */

import { dialog } from "electron"

import type { CourseworkScoreUpsertInput } from "../../src/types/coursework.types"
import type {
  CourseworkImportDecisions,
  CourseworkMatchingMethod,
} from "../../src/types/courseworkArchive.types"
import type { ConfirmedDeletionCount } from "../../src/types/deletionConfirmation.types"
import type { ImportAction } from "../../src/types/importAction.types"
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
import {
  createCourseworkLetterScale,
  deleteCourseworkLetterScale,
  reorderCourseworkLetterScales,
  updateCourseworkLetterScale,
} from "../lib/prisma/courseworkLetterScale"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 試験外成績資料の CRUD・評価項目・点数・名簿・タグ用 IPC チャンネルを登録する */
export const courseworkHandlers = {
  // Coursework（トップレベル）
  "coursework:getAll": async () => {
    return getCourseworks()
  },

  "coursework:getById": async (id: string) => {
    return getCourseworkById(id)
  },

  "coursework:create": async (data: {
    /** renderer が振った uuid（規約: id は呼び出し側で決める） */
    id?: string
    name: string
    description?: string | null
    referenceDate?: string | null
  }) => {
    return createCoursework(data)
  },

  "coursework:update": async (
    id: string,
    data: {
      name?: string
      description?: string | null
      referenceDate?: string | null
    }
  ) => {
    return updateCoursework(id, data)
  },

  "coursework:delete": async (id: string) => {
    return deleteCoursework(id)
  },

  "coursework:getCandidates": async () => {
    return getCourseworkCandidates()
  },

  // CourseworkItem（評価項目）
  "coursework:createItem": async (data: {
    courseworkId: string
    name: string
    maxScore: number
    inputMode?: string
    letterScales?: { label: string; score: number; order: number }[]
  }) => {
    return createCourseworkItem(data)
  },

  "coursework:updateItem": async (
    id: string,
    data: {
      name?: string
      maxScore?: number
      inputMode?: string
    }
  ) => {
    return updateCourseworkItem(id, data)
  },

  // CourseworkLetterScale（文字評価の刻み）。1行ずつ書く
  "coursework:createLetterScale": async (data: {
    courseworkItemId: string
    label: string
    score: number
    order: number
  }) => {
    return createCourseworkLetterScale(data)
  },

  "coursework:updateLetterScale": async (data: {
    id: string
    label?: string
    score?: number
  }) => {
    const { id, ...rest } = data
    return updateCourseworkLetterScale(id, rest)
  },

  "coursework:deleteLetterScale": async (id: string) => {
    return deleteCourseworkLetterScale(id)
  },

  "coursework:reorderLetterScales": async (
    items: { id: string; order: number }[]
  ) => {
    return reorderCourseworkLetterScales(items)
  },

  "coursework:deleteItem": async (id: string) => {
    return deleteCourseworkItem(id)
  },

  "coursework:reorderItems": async (items: { id: string; order: number }[]) => {
    return reorderCourseworkItems(items)
  },

  // CourseworkScore（点数）
  "coursework:getScores": async (courseworkItemId: string) => {
    return getCourseworkScoresByItemId(courseworkItemId)
  },

  "coursework:batchUpsertScores": async (
    scores: CourseworkScoreUpsertInput[]
  ) => {
    return batchUpsertCourseworkScores(scores)
  },

  // 名簿（CourseworkStudent / CourseworkClassroom）
  "coursework:getStudents": async (courseworkId: string) => {
    return getCourseworkStudents(courseworkId)
  },

  "coursework:getClassrooms": async (courseworkId: string) => {
    return getCourseworkClassrooms(courseworkId)
  },

  "coursework:getAvailableClassrooms": async (
    courseworkId: string,
    activeOnly?: boolean
  ) => {
    return getAvailableClassroomsForCoursework(courseworkId, activeOnly)
  },

  "coursework:getAvailableStudents": async (
    courseworkId: string,
    activeOnly?: boolean
  ) => {
    return getAvailableStudentsForCoursework(courseworkId, activeOnly)
  },

  "coursework:addStudentsFromClassroom": async (
    courseworkId: string,
    classroomId: string,
    activeOnly?: boolean
  ) => {
    return addStudentsFromClassroomToCoursework(
      courseworkId,
      classroomId,
      activeOnly
    )
  },

  "coursework:addStudents": async (
    courseworkId: string,
    studentIds: string[]
  ) => {
    return addStudentsToCoursework(courseworkId, studentIds)
  },

  "coursework:updateStudentOrders": async (
    courseworkId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    return updateCourseworkStudentOrders(courseworkId, studentOrders)
  },

  "coursework:removeStudents": async (
    courseworkId: string,
    studentIds: string[]
  ) => {
    return removeStudentsFromCoursework(courseworkId, studentIds)
  },

  // 利用者が見た件数を添えて削除する（消す直前に数え直し、増えていれば中止する）
  "coursework:removeClassroom": async (
    courseworkId: string,
    classroomId: string,
    deleteStudents: boolean,
    confirmedCounts: ConfirmedDeletionCount[]
  ) => {
    return removeClassroomFromCoursework(
      courseworkId,
      classroomId,
      deleteStudents,
      confirmedCounts
    )
  },

  "coursework:classroomRemovalPreview": async (
    courseworkId: string,
    classroomId: string
  ) => {
    return getCourseworkClassroomRemovalPreview(courseworkId, classroomId)
  },

  "coursework:setClassroomOrders": async (
    courseworkId: string,
    orderedClassroomIds: string[]
  ) => {
    return setCourseworkClassroomOrders(courseworkId, orderedClassroomIds)
  },

  // タグ（CourseworkTag）
  "coursework:setTags": async (courseworkId: string, tagIds: string[]) => {
    return setCourseworkTags(courseworkId, tagIds)
  },

  "coursework:addTag": async (courseworkId: string, tagId: string) => {
    return addCourseworkTag(courseworkId, tagId)
  },

  // ── アーカイブ（.coursework のエクスポート／インポート）────────────
  // エクスポート（保存ダイアログは exportCoursework 内で表示）
  "coursework:exportArchive": async (courseworkId: string) => {
    return exportCoursework({ courseworkId })
  },

  // インポートファイル選択ダイアログ
  "coursework:selectImportFile": async () => {
    const result = await dialog.showOpenDialog({
      title: "試験外成績資料をインポート",
      filters: [
        { name: "試験外成績資料", extensions: ["coursework"] },
        { name: "すべてのファイル", extensions: ["*"] },
      ],
      properties: ["openFile"],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }
    return { canceled: false as const, filePath: result.filePaths[0] }
  },

  // アーカイブ解析（プレビュー）
  "coursework:analyzeArchive": async (options: { archivePath: string }) => {
    const extracted = await extractCourseworkArchive(options.archivePath)
    try {
      return await previewCourseworkImport(extracted.data)
    } finally {
      cleanupCourseworkTempDir(extracted.tempDir)
    }
  },

  // インポート実行
  "coursework:importArchive": async (options: {
    archivePath: string
    courseworkDecisions?: CourseworkImportDecisions
    studentMatching?: CourseworkMatchingMethod
    /** 取り込みの方針（上書きする / 統合する / 別で追加する）。省略時は統合 */
    action?: ImportAction
  }) => {
    const extracted = await extractCourseworkArchive(options.archivePath)
    try {
      return await importCourseworkArchive(extracted.data, {
        courseworkDecisions: options.courseworkDecisions,
        studentMatching: options.studentMatching,
        action: options.action,
      })
    } finally {
      cleanupCourseworkTempDir(extracted.tempDir)
    }
  },
} satisfies HandlerMap
