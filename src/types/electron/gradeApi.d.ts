/**
 * Grade（成績算出）関連API
 */
export interface GradeAPI {
  grade: {
    getAll: () => Promise<{
      success: boolean
      grades?: import("../grade.types").GradeWithDetails[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithDetails
      error?: string
    }>
    create: (data: {
      name: string
      description?: string
      referenceDate?: string | null
    }) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithDetails
      error?: string
    }>
    update: (
      id: string,
      data: {
        name?: string
        description?: string
        referenceDate?: string | null
      }
    ) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithDetails
      error?: string
    }>
    delete: (id: string) => Promise<{ success: boolean; error?: string }>
    // 生徒・学級管理
    getStudents: (gradeId: string) => Promise<{
      success: boolean
      students?: Array<{
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
            classId: string
            attendanceNumber: number | null
            class: { id: string; name: string }
          }>
        }
      }>
      error?: string
    }>
    getClasses: (gradeId: string) => Promise<{
      success: boolean
      classes?: Array<{
        id: string
        classId: string
        className: string
        order: number
        studentCount: number
      }>
      error?: string
    }>
    getAvailableClasses: (
      gradeId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      classes?: Array<{
        id: string
        name: string
        classCode: string | null
        grade: number | null
        studentCount: number
        studentNames: string[]
      }>
      error?: string
    }>
    getAvailableStudents: (
      gradeId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      students?: import("../prismaExtensions").StudentWithMemberships[]
      error?: string
    }>
    addStudentsFromClass: (
      gradeId: string,
      classId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      added?: number
      skipped?: number
      error?: string
    }>
    addStudentsToGrade: (
      gradeId: string,
      studentIds: string[]
    ) => Promise<{
      success: boolean
      addedCount?: number
      skippedCount?: number
      error?: string
    }>
    removeClass: (
      gradeId: string,
      classId: string,
      deleteStudents?: boolean
    ) => Promise<{
      success: boolean
      removedStudents?: number
      error?: string
    }>
    classRemovalPreview: (
      gradeId: string,
      classId: string
    ) => Promise<{
      success: boolean
      exclusiveCount?: number
      error?: string
    }>
    setClassOrders: (
      gradeId: string,
      orderedClassIds: string[]
    ) => Promise<{ success: boolean; error?: string }>
    updateStudentOrders: (
      gradeId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    // GradeItem
    getGradeItems: (gradeId: string) => Promise<{
      success: boolean
      gradeItems?: import("../grade.types").GradeItemWithDetails[]
      error?: string
    }>
    createGradeItem: (data: { gradeId: string; name: string }) => Promise<{
      success: boolean
      gradeItem?: import("../grade.types").GradeItemWithDetails
      error?: string
    }>
    updateGradeItem: (
      id: string,
      data: { name?: string }
    ) => Promise<{
      success: boolean
      gradeItem?: import("../grade.types").GradeItemWithDetails
      error?: string
    }>
    deleteGradeItem: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    reorderGradeItems: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    // データソース
    createDataSource: (data: {
      gradeItemId: string
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
      courseworkItemId?: string
      name: string
      weight: number
      absentMethod?: string
      absentRatio?: number
      absentOffset?: number
      treatExpectedAsMissing?: boolean
      estimationMode?: string
      estimationSourceIds?: string[]
    }) => Promise<{
      success: boolean
      dataSource?: import("../grade.types").GradeDataSourceWithDetails
      error?: string
    }>
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
    ) => Promise<{
      success: boolean
      dataSource?: import("../grade.types").GradeDataSourceWithDetails
      error?: string
    }>
    deleteDataSource: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    reorderDataSources: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>
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
    ) => Promise<{ success: boolean; error?: string }>
    getBoundarySets: (gradeId: string) => Promise<{
      success: boolean
      boundarySets?: import("../grade.types").GradeBoundarySetWithDetails[]
      error?: string
    }>
    upsertBoundarySet: (data: {
      gradeId: string
      targetType: string
      gradeItemId: string | null
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => Promise<{
      success: boolean
      boundarySet?: import("../grade.types").GradeBoundarySetWithDetails
      error?: string
    }>
    deleteBoundarySet: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    upsertGradeOverride: (data: {
      gradeId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
      overrideLabel: string
    }) => Promise<{ success: boolean; override?: unknown; error?: string }>
    deleteGradeOverride: (data: {
      gradeId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
    }) => Promise<{ success: boolean; error?: string }>
    getGradeConstraints: (gradeId: string) => Promise<{
      success: boolean
      constraints?: import("../grade.types").GradeConstraintData[]
      error?: string
    }>
    createGradeConstraint: (data: {
      gradeId: string
      constraint: import("../grade.types").GradeConstraintInput
    }) => Promise<{
      success: boolean
      constraint?: import("../grade.types").GradeConstraintData
      error?: string
    }>
    updateGradeConstraint: (data: {
      id: string
      constraint: Partial<import("../grade.types").GradeConstraintInput>
    }) => Promise<{
      success: boolean
      constraint?: import("../grade.types").GradeConstraintData
      error?: string
    }>
    deleteGradeConstraint: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    getGradeItemExclusions: (gradeId: string) => Promise<{
      success: boolean
      exclusions?: Array<{
        id: string
        gradeId: string
        studentId: string
        gradeItemId: string
      }>
      error?: string
    }>
    setGradeItemExclusion: (data: {
      gradeId: string
      studentId: string
      gradeItemId: string
      excluded: boolean
    }) => Promise<{ success: boolean; error?: string }>
    batchUpdateGradeItemExclusions: (
      gradeId: string,
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) => Promise<{ success: boolean; error?: string }>
    calculateGrades: (gradeId: string) => Promise<{
      success: boolean
      result?: import("../grade.types").GradeCalculationResult
      error?: string
    }>
    getExamCandidates: () => Promise<{
      success: boolean
      exams?: Array<{ id: string; examName: string; examDate: Date | null }>
      error?: string
    }>
    getExamSubtotalGroups: (examId: string) => Promise<{
      success: boolean
      subtotalGroups?: Array<{
        id: string
        name: string
        subtotals: Array<{ id: string; name: string; order: number }>
      }>
      error?: string
    }>
    getExamCropRegions: (examId: string) => Promise<{
      success: boolean
      cropRegions?: Array<{
        id: string
        label: string
        type: string
        points: number | null
        orderIndex: number | null
      }>
      error?: string
    }>
    calculateSourceMaxScore: (data: {
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
      courseworkItemId?: string
    }) => Promise<{ success: boolean; maxScore?: number; error?: string }>
    exportExcel: (
      gradeId: string,
      options?: { studentIds?: string[] }
    ) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
    getExportSettings: (gradeId: string) => Promise<{
      success: boolean
      settings?: Record<string, unknown> | null
      error?: string
    }>
    saveExportSettings: (
      gradeId: string,
      settings: Record<string, unknown>
    ) => Promise<{
      success: boolean
      error?: string
    }>
    exportArchive: (gradeId: string) => Promise<{
      success: boolean
      error?: string
    }>
    importArchive: () => Promise<{
      success: boolean
      preview?: import("../gradeArchive.types").GradeArchiveImportPreview
      archiveData?: import("../gradeArchive.types").GradeArchiveData
      error?: string
    }>
    executeImport: (
      archiveData: import("../gradeArchive.types").GradeArchiveData,
      options?: import("../gradeArchive.types").GradeArchiveImportOptions
    ) => Promise<{
      success: boolean
      gradeId?: string
      error?: string
      warnings?: string[]
    }>
  }
}
