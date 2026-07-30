/**
 * Grade（成績算出）関連API
 */
export interface GradeAPI {
  grade: {
    getAll: () => Promise<{
      success: boolean
      grades?: import("../grade.types").GradeWithRelations[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithRelations
      error?: string
    }>
    create: (data: {
      name: string
      description?: string
      referenceDate?: string | null
    }) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithRelations
      error?: string
    }>
    update: (
      id: string,
      data: {
        name?: string
        description?: string | null
        referenceDate?: string | null
      }
    ) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithRelations
      error?: string
    }>
    delete: (id: string) => Promise<{ success: boolean; error?: string }>
    duplicate: (id: string) => Promise<{
      success: boolean
      grade?: import("../grade.types").GradeWithRelations
      error?: string
    }>
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
            classroomId: string
            attendanceNumber: number | null
            classroom: { id: string; name: string }
          }>
        }
      }>
      error?: string
    }>
    getClassrooms: (gradeId: string) => Promise<{
      success: boolean
      classrooms?: Array<{
        id: string
        classroomId: string
        className: string
        order: number
        studentCount: number
      }>
      error?: string
    }>
    getAvailableClassrooms: (
      gradeId: string,
      activeOnly?: boolean
    ) => Promise<{
      success: boolean
      classrooms?: Array<{
        id: string
        name: string
        classroomCode: string | null
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
    addStudentsFromClassroom: (
      gradeId: string,
      classroomId: string,
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
    removeClassroom: (
      gradeId: string,
      classroomId: string,
      deleteStudents?: boolean
    ) => Promise<{
      success: boolean
      removedStudents?: number
      error?: string
    }>
    classroomRemovalPreview: (
      gradeId: string,
      classroomId: string
    ) => Promise<{
      success: boolean
      exclusiveCount?: number
      error?: string
    }>
    setClassroomOrders: (
      gradeId: string,
      orderedClassroomIds: string[]
    ) => Promise<{ success: boolean; error?: string }>
    updateStudentOrders: (
      gradeId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    // GradeItem
    getGradeItems: (gradeId: string) => Promise<{
      success: boolean
      gradeItems?: import("../grade.types").GradeItemWithDataSources[]
      error?: string
    }>
    createGradeItem: (data: { gradeId: string; name: string }) => Promise<{
      success: boolean
      gradeItem?: import("../grade.types").GradeItemWithDataSources
      error?: string
    }>
    updateGradeItem: (
      id: string,
      data: { name?: string }
    ) => Promise<{
      success: boolean
      gradeItem?: import("../grade.types").GradeItemWithDataSources
      error?: string
    }>
    deleteGradeItem: (id: string) => Promise<{
      success: boolean
      error?: string
      /** 集計対象がこの項目を含むため無効化した制約ルール名（利用者へ知らせる） */
      disabledConstraintNames?: string[]
    }>
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
      courseworkId?: string
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
      dataSource?: import("../grade.types").GradeDataSourceWithRelations
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
      dataSource?: import("../grade.types").GradeDataSourceWithRelations
      error?: string
    }>
    deleteDataSource: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    reorderDataSources: (
      items: { id: string; order: number }[]
    ) => Promise<{ success: boolean; error?: string }>
    getBoundarySets: (gradeId: string) => Promise<{
      success: boolean
      boundarySets?: import("../grade.types").GradeBoundarySetWithItemAndBoundaries[]
      error?: string
    }>
    upsertBoundarySet: (data: {
      gradeId: string
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => Promise<{
      success: boolean
      boundarySet?: import("../grade.types").GradeBoundarySetWithItemAndBoundaries
      error?: string
    }>
    deleteBoundarySet: (
      id: string
    ) => Promise<{ success: boolean; error?: string }>
    upsertGradeOverride: (
      data: import("../grade.types").GradeCellTarget & {
        overrideLabel: string
      }
    ) => Promise<{ success: boolean; override?: unknown; error?: string }>
    deleteGradeOverride: (
      target: import("../grade.types").GradeCellTarget
    ) => Promise<{ success: boolean; error?: string }>
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
      exclusions?: import("@prisma/client").GradeItemExclusion[]
      error?: string
    }>
    setGradeItemExclusion: (
      input: import("../grade.types").GradeItemExclusionInput
    ) => Promise<{ success: boolean; error?: string }>
    batchUpdateGradeItemExclusions: (
      updates: import("../grade.types").GradeItemExclusionInput[]
    ) => Promise<{ success: boolean; error?: string }>
    calculateGrades: (gradeId: string) => Promise<{
      success: boolean
      result?: import("../grade.types").GradeCalculationResult
      error?: string
    }>
    /** 各データソースのモデル適合度 R（手法選択画面の判断材料）を保存設定で算出 */
    computeSourceFits: (gradeId: string) => Promise<{
      success: boolean
      fits?: Record<string, { correlation: number; sampleSize: number } | null>
      error?: string
    }>
    /**
     * 成績値を確定（凍結）する。確定時点の実効値（自動算出→手動上書き適用後）を保存し、
     * 以後は参照資料・境界の変更に追従させない。既に確定済みのセルを含めれば再確定になる。
     * targets 未指定は Grade 全体の一括確定。対象の同定は (studentId, gradeItemId)。
     */
    freezeGradeScores: (data: {
      gradeId: string
      targets?: import("../grade.types").GradeCellTarget[]
      frozenByUserId?: string | null
    }) => Promise<{ success: boolean; frozenCount?: number; error?: string }>
    /** 成績値の確定を解除する（リアルタイム算出値へ戻す）。targets 未指定は Grade 全体 */
    unfreezeGradeScores: (data: {
      gradeId: string
      targets?: import("../grade.types").GradeCellTarget[]
      userId?: string | null
    }) => Promise<{ success: boolean; unfrozenCount?: number; error?: string }>
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
