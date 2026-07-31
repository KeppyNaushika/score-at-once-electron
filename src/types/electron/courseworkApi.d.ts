/**
 * Coursework（試験外成績資料）関連 API
 */

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
    getAll: () => Promise<{
      success: boolean
      courseworks?: CourseworkSummary[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      coursework?: CourseworkWithRelations
      error?: string
    }>
    create: (data: {
      name: string
      description?: string | null
      date?: string | null
    }) => Promise<{
      success: boolean
      coursework?: CourseworkWithRelations
      error?: string
    }>
    update: (
      id: string,
      data: {
        name?: string
        description?: string | null
        date?: string | null
      }
    ) => Promise<{
      success: boolean
      coursework?: CourseworkWithRelations
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
      usedBy?: string[]
    }>
    getCandidates: () => Promise<{
      success: boolean
      courseworks?: {
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
      error?: string
    }>

    // 評価項目
    createItem: (data: {
      courseworkId: string
      name: string
      maxScore: number
      inputMode?: string
      letterScales?: { label: string; score: number; order: number }[]
    }) => Promise<{
      success: boolean
      item?: CourseworkItemWithLetterScales
      error?: string
    }>
    updateItem: (
      id: string,
      data: {
        name?: string
        maxScore?: number
        inputMode?: string
        letterScales?: { label: string; score: number; order: number }[]
      }
    ) => Promise<{
      success: boolean
      item?: CourseworkItemWithLetterScales
      error?: string
    }>
    deleteItem: (id: string) => Promise<{
      success: boolean
      error?: string
      usedBy?: string[]
    }>
    reorderItems: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>

    // 点数
    getScores: (courseworkItemId: string) => Promise<{
      success: boolean
      scores?: CourseworkScoreWithCourseworkStudent[]
      error?: string
    }>
    batchUpsertScores: (
      scores: CourseworkScoreUpsertInput[]
    ) => Promise<{ success: boolean; error?: string }>

    // 名簿
    getStudents: (courseworkId: string) => Promise<{
      success: boolean
      students?: CourseworkStudentWithMemberships[]
      error?: string
    }>
    getClassrooms: (courseworkId: string) => Promise<{
      success: boolean
      classrooms?: {
        id: string
        classroomId: string
        className: string
        order: number
        studentCount: number
      }[]
      error?: string
    }>
    getAvailableClassrooms: (
      courseworkId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      classrooms?: {
        id: string
        name: string
        studentCount: number
      }[]
      error?: string
    }>
    getAvailableStudents: (
      courseworkId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      students?: {
        id: string
        studentNumber: string
        lastName: string
        firstName: string
        className: string | null
      }[]
      error?: string
    }>
    addStudentsFromClassroom: (
      courseworkId: string,
      classroomId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      added?: number
      skipped?: number
      error?: string
    }>
    addStudents: (
      courseworkId: string,
      studentIds: string[]
    ) => Promise<{
      success: boolean
      addedCount?: number
      skippedCount?: number
      error?: string
    }>
    updateStudentOrders: (
      courseworkId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    removeStudents: (
      courseworkId: string,
      studentIds: string[]
    ) => Promise<{ success: boolean; removedCount?: number; error?: string }>
    removeClassroom: (
      courseworkId: string,
      classroomId: string,
      deleteStudents?: boolean
    ) => Promise<{
      success: boolean
      removedStudents?: number
      error?: string
    }>
    classroomRemovalPreview: (
      courseworkId: string,
      classroomId: string
    ) => Promise<{
      success: boolean
      exclusiveCount?: number
      error?: string
    }>
    setClassroomOrders: (
      courseworkId: string,
      orderedClassroomIds: string[]
    ) => Promise<{ success: boolean; error?: string }>

    // タグ
    setTags: (
      courseworkId: string,
      tagIds: string[]
    ) => Promise<{ success: boolean; error?: string }>
    addTag: (
      courseworkId: string,
      tagId: string
    ) => Promise<{ success: boolean; error?: string }>

    // アーカイブ（.coursework のエクスポート／インポート）
    exportArchive: (
      courseworkId: string
    ) => Promise<ExportCourseworkArchiveResult>
    selectImportFile: () => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
      error?: string
    }>
    analyzeArchive: (options: { archivePath: string }) => Promise<{
      success: boolean
      preview?: CourseworkArchiveImportPreview
      error?: string
    }>
    importArchive: (options: {
      archivePath: string
      courseworkDecisions?: CourseworkImportDecisions
      studentMatching?: CourseworkMatchingMethod
    }) => Promise<CourseworkArchiveImportResult>
  }
}
