/**
 * Grade（成績算出）関連API
 */

import type { GradeItemExclusion } from "@prisma/client"

import type { FileExportResult } from "@/electron-src/lib/shared/types"

import type {
  GradeCalculationResult,
  GradeCellTarget,
  GradeConstraintData,
  GradeConstraintInput,
  GradeDataSourceWithRelations,
  GradeItemExclusionInput,
  GradeItemWithDataSources,
  GradeSummary,
  GradeWithRelations,
} from "../grade.types"
import type {
  GradeArchiveData,
  GradeArchiveImportOptions,
  GradeArchiveImportPreview,
} from "../gradeArchive.types"
import type { StudentWithMemberships } from "../prismaExtensions"

export interface GradeAPI {
  grade: {
    getAll: () => Promise<GradeSummary[]>
    getById: (id: string) => Promise<GradeWithRelations>
    create: (data: {
      name: string
      description?: string
      referenceDate?: string | null
    }) => Promise<GradeWithRelations>
    update: (
      id: string,
      data: {
        name?: string
        description?: string | null
        referenceDate?: string | null
      }
    ) => Promise<GradeWithRelations>
    delete: (id: string) => Promise<void>
    duplicate: (id: string) => Promise<GradeWithRelations>
    // 生徒・学級管理
    getStudents: (gradeId: string) => Promise<
      Array<{
        id: string
        gradeId: string
        studentId: string
        customOrder: number | null
        student: {
          id: string
          studentNumber: string
          lastName: string
          firstName: string
          memberships: Array<{
            classroomId: string
            attendanceNumber: number | null
            classroom: { id: string; name: string }
          }>
        }
      }>
    >
    getClassrooms: (gradeId: string) => Promise<
      Array<{
        id: string
        classroomId: string
        className: string
        order: number
        studentCount: number
      }>
    >
    getAvailableClassrooms: (
      gradeId: string,
      activeOnly?: boolean
    ) => Promise<
      Array<{
        id: string
        name: string
        classroomCode: string | null
        grade: number | null
        studentCount: number
        studentNames: string[]
      }>
    >
    getAvailableStudents: (
      gradeId: string,
      activeOnly?: boolean
    ) => Promise<StudentWithMemberships[]>
    addStudentsFromClassroom: (
      gradeId: string,
      classroomId: string,
      activeOnly?: boolean
    ) => Promise<{ added: number; skipped: number }>
    addStudentsToGrade: (
      gradeId: string,
      studentIds: string[]
    ) => Promise<{ addedCount: number; skippedCount: number }>
    removeClassroom: (
      gradeId: string,
      classroomId: string,
      deleteStudents?: boolean
    ) => Promise<{ removedStudents: number }>
    classroomRemovalPreview: (
      gradeId: string,
      classroomId: string
    ) => Promise<{ exclusiveCount: number }>
    setClassroomOrders: (
      gradeId: string,
      orderedClassroomIds: string[]
    ) => Promise<void>
    updateStudentOrders: (
      gradeId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<void>
    // GradeItem
    createGradeItem: (data: {
      gradeId: string
      name: string
    }) => Promise<GradeItemWithDataSources>
    updateGradeItem: (
      id: string,
      data: { name?: string }
    ) => Promise<GradeItemWithDataSources>
    deleteGradeItem: (id: string) => Promise<{
      /** 集計対象がこの項目を含むため無効化した制約ルール名（利用者へ知らせる） */
      disabledConstraintNames: string[]
    }>
    reorderGradeItems: (items: { id: string; order: number }[]) => Promise<void>
    // データソース
    createDataSource: (data: {
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
    }) => Promise<GradeDataSourceWithRelations>
    updateDataSource: (
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
    ) => Promise<GradeDataSourceWithRelations>
    deleteDataSource: (id: string) => Promise<void>
    reorderDataSources: (
      items: { id: string; order: number }[]
    ) => Promise<void>
    replaceGradeItemBoundaries: (data: {
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => Promise<void>
    deleteGradeItemBoundaries: (gradeItemId: string) => Promise<void>
    upsertGradeOverride: (
      data: GradeCellTarget & {
        overrideLabel: string
      }
    ) => Promise<unknown>
    deleteGradeOverride: (target: GradeCellTarget) => Promise<void>
    getGradeConstraints: (gradeId: string) => Promise<GradeConstraintData[]>
    createGradeConstraint: (data: {
      gradeId: string
      constraint: GradeConstraintInput
    }) => Promise<GradeConstraintData>
    updateGradeConstraint: (data: {
      id: string
      constraint: Partial<GradeConstraintInput>
    }) => Promise<GradeConstraintData>
    deleteGradeConstraint: (id: string) => Promise<void>
    getGradeItemExclusions: (gradeId: string) => Promise<GradeItemExclusion[]>
    setGradeItemExclusion: (input: GradeItemExclusionInput) => Promise<void>
    calculateGrades: (gradeId: string) => Promise<GradeCalculationResult>
    /** 各データソースのモデル適合度 R（手法選択画面の判断材料）を保存設定で算出 */
    computeSourceFits: (
      gradeId: string
    ) => Promise<
      Record<string, { correlation: number; sampleSize: number } | null>
    >
    /**
     * 成績値を確定（凍結）する。確定時点の実効値（自動算出→手動上書き適用後）を保存し、
     * 以後は参照資料・境界の変更に追従させない。既に確定済みのセルを含めれば再確定になる。
     * targets 未指定は Grade 全体の一括確定。対象の同定は (studentId, gradeItemId)。
     */
    freezeGradeScores: (data: {
      gradeId: string
      targets?: GradeCellTarget[]
      frozenByUserId?: string | null
    }) => Promise<{ frozenCount: number }>
    /** 成績値の確定を解除する（リアルタイム算出値へ戻す）。targets 未指定は Grade 全体 */
    unfreezeGradeScores: (data: {
      gradeId: string
      targets?: GradeCellTarget[]
      userId?: string | null
    }) => Promise<{ unfrozenCount: number }>
    getExamCandidates: () => Promise<
      Array<{ id: string; examName: string; examDate: Date | null }>
    >
    getExamSubtotalGroups: (examId: string) => Promise<
      Array<{
        id: string
        name: string
        subtotals: Array<{ id: string; name: string; order: number }>
      }>
    >
    getExamCropRegions: (examId: string) => Promise<
      Array<{
        id: string
        label: string
        type: string
        points: number | null
        orderIndex: number | null
        /** 小計への割り当て。renderer が満点を追加クエリ無しで算出するために同梱される */
        cropSubtotals: Array<{ subtotalId: string }>
      }>
    >
    exportExcel: (
      gradeId: string,
      options?: { studentIds?: string[] }
    ) => Promise<FileExportResult>
    getExportSettings: (
      gradeId: string
    ) => Promise<Record<string, unknown> | null>
    saveExportSettings: (
      gradeId: string,
      settings: Record<string, unknown>
    ) => Promise<void>
    exportArchive: (
      gradeId: string
    ) => Promise<{ canceled: true } | { canceled: false; outputPath: string }>
    importArchive: () => Promise<
      | { canceled: true }
      | {
          canceled: false
          preview: GradeArchiveImportPreview
          archiveData: GradeArchiveData
        }
    >
    executeImport: (
      archiveData: GradeArchiveData,
      options?: GradeArchiveImportOptions
    ) => Promise<{ gradeId: string; warnings: string[] }>
  }
}
