/**
 * Coursework（試験外成績資料）関連 API
 */

import type { CourseworkDeleteResult } from "@/electron-src/lib/prisma/coursework"

import type {
  CourseworkItemWithLetterScales,
  CourseworkScoreUpsertInput,
  CourseworkScoreWithCourseworkStudent,
  CourseworkStudentWithMemberships,
  CourseworkSummary,
  CourseworkWithRelations,
} from "../coursework.types"
import type {
  CourseworkArchiveImportPreview,
  CourseworkArchiveImportResult,
  CourseworkImportDecisions,
  CourseworkMatchingMethod,
  ExportCourseworkArchiveResult,
} from "../courseworkArchive.types"

export interface CourseworkAPI {
  coursework: {
    // Coursework（トップレベル）
    getAll: () => Promise<CourseworkSummary[]>
    getById: (id: string) => Promise<CourseworkWithRelations>
    create: (data: {
      name: string
      description?: string | null
      date?: string | null
    }) => Promise<CourseworkWithRelations>
    update: (
      id: string,
      data: {
        name?: string
        description?: string | null
        date?: string | null
      }
    ) => Promise<CourseworkWithRelations>
    /** 成績算出から参照されているときは消さず、参照元の成績名を返す */
    delete: (id: string) => Promise<CourseworkDeleteResult>
    getCandidates: () => Promise<
      {
        id: string
        name: string
        date: string | null
        items: {
          id: string
          name: string
          maxScore: number
          inputMode: string
          order: number
        }[]
      }[]
    >

    // 評価項目
    createItem: (data: {
      courseworkId: string
      name: string
      maxScore: number
      inputMode?: string
      letterScales?: { label: string; score: number; order: number }[]
    }) => Promise<CourseworkItemWithLetterScales>
    updateItem: (
      id: string,
      data: {
        name?: string
        maxScore?: number
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }
    ) => Promise<CourseworkItemWithLetterScales>
    /** 成績算出から参照されているときは消さず、参照元の成績名を返す */
    deleteItem: (id: string) => Promise<CourseworkDeleteResult>
    reorderItems: (items: { id: string; order: number }[]) => Promise<void>

    // 点数
    getScores: (
      courseworkItemId: string
    ) => Promise<CourseworkScoreWithCourseworkStudent[]>
    batchUpsertScores: (scores: CourseworkScoreUpsertInput[]) => Promise<void>

    // 名簿
    getStudents: (
      courseworkId: string
    ) => Promise<CourseworkStudentWithMemberships[]>
    getClassrooms: (courseworkId: string) => Promise<
      {
        id: string
        classroomId: string
        className: string
        order: number
        studentCount: number
      }[]
    >
    getAvailableClassrooms: (
      courseworkId: string,
      activeOnly?: boolean
    ) => Promise<
      {
        id: string
        name: string
        studentCount: number
      }[]
    >
    getAvailableStudents: (
      courseworkId: string,
      activeOnly?: boolean
    ) => Promise<
      {
        id: string
        studentNumber: string
        lastName: string
        firstName: string
        className: string | null
      }[]
    >
    addStudentsFromClassroom: (
      courseworkId: string,
      classroomId: string,
      activeOnly?: boolean
    ) => Promise<{ added: number; skipped: number }>
    addStudents: (
      courseworkId: string,
      studentIds: string[]
    ) => Promise<{ addedCount: number; skippedCount: number }>
    updateStudentOrders: (
      courseworkId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<void>
    removeStudents: (
      courseworkId: string,
      studentIds: string[]
    ) => Promise<{ removedCount: number }>
    removeClassroom: (
      courseworkId: string,
      classroomId: string,
      deleteStudents?: boolean
    ) => Promise<{ removedStudents: number }>
    classroomRemovalPreview: (
      courseworkId: string,
      classroomId: string
    ) => Promise<{ exclusiveCount: number }>
    setClassroomOrders: (
      courseworkId: string,
      orderedClassroomIds: string[]
    ) => Promise<void>

    // タグ
    setTags: (courseworkId: string, tagIds: string[]) => Promise<void>
    addTag: (courseworkId: string, tagId: string) => Promise<void>

    // アーカイブ（.coursework のエクスポート／インポート）
    exportArchive: (
      courseworkId: string
    ) => Promise<ExportCourseworkArchiveResult>
    selectImportFile: () => Promise<
      { canceled: true } | { canceled: false; filePath: string }
    >
    analyzeArchive: (options: {
      archivePath: string
    }) => Promise<CourseworkArchiveImportPreview>
    importArchive: (options: {
      archivePath: string
      courseworkDecisions?: CourseworkImportDecisions
      studentMatching?: CourseworkMatchingMethod
    }) => Promise<CourseworkArchiveImportResult>
  }
}
