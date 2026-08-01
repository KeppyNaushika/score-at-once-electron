import { ipcRenderer } from "electron"

import type {
  GradeCellTarget,
  GradeItemExclusionInput,
} from "../../src/types/grade.types"
import type { GradeArchiveImportOptions } from "../../src/types/gradeArchive.types"

/** 成績算出のIPC API（成績CRUD・データソース・評定境界・手動点数・Excel出力） */
export function createGradeApi() {
  return {
    // Grade（成績算出）
    grade: {
      getAll: () => ipcRenderer.invoke("grade:getAll"),
      getById: (id: string) => ipcRenderer.invoke("grade:getById", id),
      create: (data: {
        name: string
        description?: string
        referenceDate?: string | null
      }) => ipcRenderer.invoke("grade:create", data),
      update: (
        id: string,
        data: {
          name?: string
          description?: string
          referenceDate?: string | null
        }
      ) => ipcRenderer.invoke("grade:update", id, data),
      delete: (id: string) => ipcRenderer.invoke("grade:delete", id),
      duplicate: (id: string) => ipcRenderer.invoke("grade:duplicate", id),
      // 生徒・学級管理
      getStudents: (gradeId: string) =>
        ipcRenderer.invoke("grade:getStudents", gradeId),
      getClassrooms: (gradeId: string) =>
        ipcRenderer.invoke("grade:getClassrooms", gradeId),
      getAvailableClassrooms: (gradeId: string, activeOnly?: boolean) =>
        ipcRenderer.invoke("grade:getAvailableClassrooms", gradeId, activeOnly),
      getAvailableStudents: (gradeId: string, activeOnly?: boolean) =>
        ipcRenderer.invoke("grade:getAvailableStudents", gradeId, activeOnly),
      addStudentsToGrade: (gradeId: string, studentIds: string[]) =>
        ipcRenderer.invoke("grade:addStudentsToGrade", gradeId, studentIds),
      addStudentsFromClassroom: (
        gradeId: string,
        classroomId: string,
        activeOnly?: boolean
      ) =>
        ipcRenderer.invoke(
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
        ipcRenderer.invoke(
          "grade:removeClassroom",
          gradeId,
          classroomId,
          deleteStudents
        ),
      classroomRemovalPreview: (gradeId: string, classroomId: string) =>
        ipcRenderer.invoke(
          "grade:classroomRemovalPreview",
          gradeId,
          classroomId
        ),
      setClassroomOrders: (gradeId: string, orderedClassroomIds: string[]) =>
        ipcRenderer.invoke(
          "grade:setClassroomOrders",
          gradeId,
          orderedClassroomIds
        ),
      updateStudentOrders: (
        gradeId: string,
        studentOrders: { studentId: string; customOrder: number }[]
      ) =>
        ipcRenderer.invoke("grade:updateStudentOrders", gradeId, studentOrders),
      // GradeItem
      getGradeItems: (gradeId: string) =>
        ipcRenderer.invoke("grade:getGradeItems", gradeId),
      createGradeItem: (data: { gradeId: string; name: string }) =>
        ipcRenderer.invoke("grade:createGradeItem", data),
      updateGradeItem: (id: string, data: { name?: string }) =>
        ipcRenderer.invoke("grade:updateGradeItem", id, data),
      deleteGradeItem: (id: string) =>
        ipcRenderer.invoke("grade:deleteGradeItem", id),
      reorderGradeItems: (items: { id: string; order: number }[]) =>
        ipcRenderer.invoke("grade:reorderGradeItems", items),
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
      }) => ipcRenderer.invoke("grade:createDataSource", data),
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
      ) => ipcRenderer.invoke("grade:updateDataSource", id, data),
      deleteDataSource: (id: string) =>
        ipcRenderer.invoke("grade:deleteDataSource", id),
      reorderDataSources: (items: { id: string; order: number }[]) =>
        ipcRenderer.invoke("grade:reorderDataSources", items),
      replaceGradeItemBoundaries: (data: {
        gradeItemId: string
        boundaries: {
          label: string
          minPercentage: number
          order: number
        }[]
      }) => ipcRenderer.invoke("grade:replaceGradeItemBoundaries", data),
      deleteGradeItemBoundaries: (gradeItemId: string) =>
        ipcRenderer.invoke("grade:deleteGradeItemBoundaries", gradeItemId),
      upsertGradeOverride: (
        data: GradeCellTarget & { overrideLabel: string }
      ) => ipcRenderer.invoke("grade:upsertGradeOverride", data),
      deleteGradeOverride: (target: GradeCellTarget) =>
        ipcRenderer.invoke("grade:deleteGradeOverride", target),
      getGradeConstraints: (gradeId: string) =>
        ipcRenderer.invoke("grade:getGradeConstraints", gradeId),
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
      }) => ipcRenderer.invoke("grade:createGradeConstraint", data),
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
      }) => ipcRenderer.invoke("grade:updateGradeConstraint", data),
      deleteGradeConstraint: (id: string) =>
        ipcRenderer.invoke("grade:deleteGradeConstraint", id),
      getGradeItemExclusions: (gradeId: string) =>
        ipcRenderer.invoke("grade:getGradeItemExclusions", gradeId),
      setGradeItemExclusion: (input: GradeItemExclusionInput) =>
        ipcRenderer.invoke("grade:setGradeItemExclusion", input),
      batchUpdateGradeItemExclusions: (updates: GradeItemExclusionInput[]) =>
        ipcRenderer.invoke("grade:batchUpdateGradeItemExclusions", updates),
      calculateGrades: (gradeId: string) =>
        ipcRenderer.invoke("grade:calculateGrades", gradeId),
      computeSourceFits: (gradeId: string) =>
        ipcRenderer.invoke("grade:computeSourceFits", gradeId),
      // 成績値の確定（凍結）。targets 未指定は Grade 全体の一括確定・一括解除。
      // 対象セルの同定は (gradeStudentId, gradeItemId)。総合の行は存在しない。
      freezeGradeScores: (data: {
        gradeId: string
        targets?: GradeCellTarget[]
        frozenByUserId?: string | null
      }) => ipcRenderer.invoke("grade:freezeGradeScores", data),
      unfreezeGradeScores: (data: {
        gradeId: string
        targets?: GradeCellTarget[]
        userId?: string | null
      }) => ipcRenderer.invoke("grade:unfreezeGradeScores", data),
      getExamCandidates: () => ipcRenderer.invoke("grade:getExamCandidates"),
      getExamSubtotalGroups: (examId: string) =>
        ipcRenderer.invoke("grade:getExamSubtotalGroups", examId),
      getExamCropRegions: (examId: string) =>
        ipcRenderer.invoke("grade:getExamCropRegions", examId),
      exportExcel: (gradeId: string, options?: { studentIds?: string[] }) =>
        ipcRenderer.invoke("grade:exportExcel", gradeId, options),
      getExportSettings: (gradeId: string) =>
        ipcRenderer.invoke("grade:getExportSettings", gradeId),
      saveExportSettings: (
        gradeId: string,
        settings: Record<string, unknown>
      ) => ipcRenderer.invoke("grade:saveExportSettings", gradeId, settings),
      exportArchive: (gradeId: string) =>
        ipcRenderer.invoke("grade:exportArchive", gradeId),
      importArchive: () => ipcRenderer.invoke("grade:importArchive"),
      executeImport: (
        archiveData: unknown,
        options?: GradeArchiveImportOptions
      ) => ipcRenderer.invoke("grade:executeImport", archiveData, options),
    },
  }
}
