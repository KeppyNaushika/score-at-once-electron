import { ipcRenderer } from "electron"

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
      // 生徒・学級管理
      getStudents: (gradeId: string) =>
        ipcRenderer.invoke("grade:getStudents", gradeId),
      getClasses: (gradeId: string) =>
        ipcRenderer.invoke("grade:getClasses", gradeId),
      getAvailableClasses: (gradeId: string, activeOnly?: boolean) =>
        ipcRenderer.invoke("grade:getAvailableClasses", gradeId, activeOnly),
      getAvailableStudents: (gradeId: string, activeOnly?: boolean) =>
        ipcRenderer.invoke("grade:getAvailableStudents", gradeId, activeOnly),
      addStudentsToGrade: (gradeId: string, studentIds: string[]) =>
        ipcRenderer.invoke("grade:addStudentsToGrade", gradeId, studentIds),
      addStudentsFromClass: (
        gradeId: string,
        classId: string,
        activeOnly?: boolean
      ) =>
        ipcRenderer.invoke(
          "grade:addStudentsFromClass",
          gradeId,
          classId,
          activeOnly
        ),
      removeClass: (gradeId: string, classId: string) =>
        ipcRenderer.invoke("grade:removeClass", gradeId, classId),
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
        name: string
        maxScore: number
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
          maxScore?: number
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
      batchUpdateAbsentPolicy: (
        dataSourceIds: string[],
        policy: {
          absentMethod: string
          absentRatio: number
          absentOffset: number
          treatExpectedAsMissing?: boolean
          estimationMode?: string
          estimationSourceIds?: string[]
        }
      ) =>
        ipcRenderer.invoke(
          "grade:batchUpdateAbsentPolicy",
          dataSourceIds,
          policy
        ),
      getManualScores: (gradeDataSourceId: string) =>
        ipcRenderer.invoke("grade:getManualScores", gradeDataSourceId),
      batchUpsertManualScores: (
        scores: {
          gradeDataSourceId: string
          studentId: string
          score: number | null
        }[]
      ) => ipcRenderer.invoke("grade:batchUpsertManualScores", scores),
      getBoundarySets: (gradeId: string) =>
        ipcRenderer.invoke("grade:getBoundarySets", gradeId),
      upsertBoundarySet: (data: {
        gradeId: string
        targetType: string
        gradeItemId: string | null
        boundaries: {
          label: string
          minPercentage: number
          order: number
        }[]
      }) => ipcRenderer.invoke("grade:upsertBoundarySet", data),
      deleteBoundarySet: (id: string) =>
        ipcRenderer.invoke("grade:deleteBoundarySet", id),
      upsertGradeOverride: (data: {
        gradeId: string
        studentId: string
        targetType: string
        gradeItemId: string | null
        overrideLabel: string
      }) => ipcRenderer.invoke("grade:upsertGradeOverride", data),
      deleteGradeOverride: (data: {
        gradeId: string
        studentId: string
        targetType: string
        gradeItemId: string | null
      }) => ipcRenderer.invoke("grade:deleteGradeOverride", data),
      getGradeItemExclusions: (gradeId: string) =>
        ipcRenderer.invoke("grade:getGradeItemExclusions", gradeId),
      setGradeItemExclusion: (data: {
        gradeId: string
        studentId: string
        gradeItemId: string
        excluded: boolean
      }) => ipcRenderer.invoke("grade:setGradeItemExclusion", data),
      batchUpdateGradeItemExclusions: (
        gradeId: string,
        updates: {
          studentId: string
          gradeItemId: string
          excluded: boolean
        }[]
      ) =>
        ipcRenderer.invoke(
          "grade:batchUpdateGradeItemExclusions",
          gradeId,
          updates
        ),
      calculateGrades: (gradeId: string) =>
        ipcRenderer.invoke("grade:calculateGrades", gradeId),
      getExamCandidates: () => ipcRenderer.invoke("grade:getExamCandidates"),
      getExamSubtotalGroups: (examId: string) =>
        ipcRenderer.invoke("grade:getExamSubtotalGroups", examId),
      getExamCropRegions: (examId: string) =>
        ipcRenderer.invoke("grade:getExamCropRegions", examId),
      calculateSourceMaxScore: (data: {
        type: string
        examId?: string
        subtotalId?: string
        cropRegionId?: string
      }) => ipcRenderer.invoke("grade:calculateSourceMaxScore", data),
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
        examMapping?: Record<string, string>
      ) => ipcRenderer.invoke("grade:executeImport", archiveData, examMapping),
    },
  }
}
