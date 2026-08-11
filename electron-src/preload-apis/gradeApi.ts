import type {
  GradeCellTarget,
  GradeItemExclusionInput,
} from "../../src/types/grade.types"
import type { GradeArchiveImportOptions } from "../../src/types/gradeArchive.types"
import { invoke } from "./invoke"

/** 成績算出のIPC API（成績CRUD・データソース・評定境界・手動点数・Excel出力） */
export function createGradeApi() {
  return {
    // Grade（成績算出）
    grade: {
      getAll: () => invoke("grade:getAll"),
      getById: (id: string) => invoke("grade:getById", id),
      create: (data: {
        name: string
        description?: string
        referenceDate?: string | null
      }) => invoke("grade:create", data),
      update: (
        id: string,
        data: {
          name?: string
          description?: string
          referenceDate?: string | null
        }
      ) => invoke("grade:update", id, data),
      delete: (id: string) => invoke("grade:delete", id),
      duplicate: (id: string) => invoke("grade:duplicate", id),
      // 生徒・学級管理
      getStudents: (gradeId: string) => invoke("grade:getStudents", gradeId),
      getClassrooms: (gradeId: string) =>
        invoke("grade:getClassrooms", gradeId),
      getAvailableClassrooms: (gradeId: string, activeOnly?: boolean) =>
        invoke("grade:getAvailableClassrooms", gradeId, activeOnly),
      getAvailableStudents: (gradeId: string, activeOnly?: boolean) =>
        invoke("grade:getAvailableStudents", gradeId, activeOnly),
      addStudentsToGrade: (gradeId: string, studentIds: string[]) =>
        invoke("grade:addStudentsToGrade", gradeId, studentIds),
      addStudentsFromClassroom: (
        gradeId: string,
        classroomId: string,
        activeOnly?: boolean
      ) =>
        invoke(
          "grade:addStudentsFromClassroom",
          gradeId,
          classroomId,
          activeOnly
        ),
      removeClassroom: (
        gradeId: string,
        classroomId: string,
        deleteStudents?: boolean
      ) =>
        invoke("grade:removeClassroom", gradeId, classroomId, deleteStudents),
      classroomRemovalPreview: (gradeId: string, classroomId: string) =>
        invoke("grade:classroomRemovalPreview", gradeId, classroomId),
      setClassroomOrders: (gradeId: string, orderedClassroomIds: string[]) =>
        invoke("grade:setClassroomOrders", gradeId, orderedClassroomIds),
      updateStudentOrders: (
        gradeId: string,
        studentOrders: { studentId: string; customOrder: number }[]
      ) => invoke("grade:updateStudentOrders", gradeId, studentOrders),
      // GradeItem
      createGradeItem: (data: { gradeId: string; name: string }) =>
        invoke("grade:createGradeItem", data),
      updateGradeItem: (id: string, data: { name?: string }) =>
        invoke("grade:updateGradeItem", id, data),
      deleteGradeItem: (id: string) => invoke("grade:deleteGradeItem", id),
      reorderGradeItems: (items: { id: string; order: number }[]) =>
        invoke("grade:reorderGradeItems", items),
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
      }) => invoke("grade:createDataSource", data),
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
      ) => invoke("grade:updateDataSource", id, data),
      deleteDataSource: (id: string) => invoke("grade:deleteDataSource", id),
      reorderDataSources: (items: { id: string; order: number }[]) =>
        invoke("grade:reorderDataSources", items),
      replaceGradeItemBoundaries: (data: {
        gradeItemId: string
        boundaries: {
          label: string
          minPercentage: number
          order: number
        }[]
      }) => invoke("grade:replaceGradeItemBoundaries", data),
      deleteGradeItemBoundaries: (gradeItemId: string) =>
        invoke("grade:deleteGradeItemBoundaries", gradeItemId),
      upsertGradeOverride: (
        data: GradeCellTarget & { overrideLabel: string }
      ) => invoke("grade:upsertGradeOverride", data),
      deleteGradeOverride: (target: GradeCellTarget) =>
        invoke("grade:deleteGradeOverride", target),
      getGradeConstraints: (gradeId: string) =>
        invoke("grade:getGradeConstraints", gradeId),
      createGradeConstraint: (data: {
        gradeId: string
        constraint: {
          name: string
          kind: string
          config: string
          expression: string
          color: string
          message: string | null
          enabled: boolean
          order: number
        }
      }) => invoke("grade:createGradeConstraint", data),
      updateGradeConstraint: (data: {
        id: string
        constraint: Partial<{
          name: string
          kind: string
          config: string
          expression: string
          color: string
          message: string | null
          enabled: boolean
          order: number
        }>
      }) => invoke("grade:updateGradeConstraint", data),
      deleteGradeConstraint: (id: string) =>
        invoke("grade:deleteGradeConstraint", id),
      getGradeItemExclusions: (gradeId: string) =>
        invoke("grade:getGradeItemExclusions", gradeId),
      setGradeItemExclusion: (input: GradeItemExclusionInput) =>
        invoke("grade:setGradeItemExclusion", input),
      calculateGrades: (gradeId: string) =>
        invoke("grade:calculateGrades", gradeId),
      computeSourceFits: (gradeId: string) =>
        invoke("grade:computeSourceFits", gradeId),
      // 成績値の確定（凍結）。targets 未指定は Grade 全体の一括確定・一括解除。
      // 対象セルの同定は (gradeStudentId, gradeItemId)。総合の行は存在しない。
      freezeGradeScores: (data: {
        gradeId: string
        targets?: GradeCellTarget[]
        frozenByUserId?: string | null
      }) => invoke("grade:freezeGradeScores", data),
      unfreezeGradeScores: (data: {
        gradeId: string
        targets?: GradeCellTarget[]
        userId?: string | null
      }) => invoke("grade:unfreezeGradeScores", data),
      getExamCandidates: () => invoke("grade:getExamCandidates"),
      getExamSubtotalGroups: (examId: string) =>
        invoke("grade:getExamSubtotalGroups", examId),
      getExamCropRegions: (examId: string) =>
        invoke("grade:getExamCropRegions", examId),
      exportExcel: (gradeId: string, options?: { studentIds?: string[] }) =>
        invoke("grade:exportExcel", gradeId, options),
      getExportSettings: (gradeId: string) =>
        invoke("grade:getExportSettings", gradeId),
      saveExportSettings: (
        gradeId: string,
        settings: Record<string, unknown>
      ) => invoke("grade:saveExportSettings", gradeId, settings),
      exportArchive: (gradeId: string) =>
        invoke("grade:exportArchive", gradeId),
      importArchive: () => invoke("grade:importArchive"),
      executeImport: (
        archiveData: unknown,
        options?: GradeArchiveImportOptions
      ) => invoke("grade:executeImport", archiveData, options),
    },
  }
}
