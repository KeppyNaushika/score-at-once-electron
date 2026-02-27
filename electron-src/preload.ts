import type { DrawingAnnotation } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { contextBridge, IpcRenderer, ipcRenderer, webUtils } from "electron"

import {
  CropRegionCreateData,
  CropRegionUpdateData,
  QuestionScoreCreateData,
  QuestionScoreUpdateData,
} from "../types/common.types"
import { CreateProjectArgs } from "../types/electron"

declare global {
  namespace NodeJS {
    interface Global {
      ipcRenderer: IpcRenderer
    }
  }
  var ipcRenderer: IpcRenderer
}

contextBridge.exposeInMainWorld("electronAPI", {
  fetchProjects: (userId: string) =>
    ipcRenderer.invoke("fetch-projects", userId),
  fetchProjectById: (projectId: string) =>
    ipcRenderer.invoke("fetch-project-by-id", projectId),
  createProject: (props: CreateProjectArgs, userId: string) => {
    return ipcRenderer.invoke("create-project", props, userId)
  },
  updateProject: (projectId: string, data: Prisma.ProjectUpdateInput) => {
    return ipcRenderer.invoke("update-project", projectId, data)
  },
  deleteProject: (
    projectId: string // project オブジェクトではなく projectId を直接渡す
  ) => ipcRenderer.invoke("delete-project", projectId),
  // Tag functions temporarily disabled
  // createTag: (tagText: string) => ipcRenderer.invoke("create-tag", tagText),
  // updateTag: (tagId: string, newText: string) =>
  //   ipcRenderer.invoke("update-tag", tagId, newText),
  // deleteTag: (tagId: string) => ipcRenderer.invoke("delete-tag", tagId),

  // User related
  fetchUsers: () => ipcRenderer.invoke("fetch-users"),
  getCurrentUser: () => ipcRenderer.invoke("get-current-user"),

  // Authentication related
  loginUser: (username: string, password: string) =>
    ipcRenderer.invoke("login-user", username, password),
  createUser: (userData: {
    username: string
    password: string
    name: string
    role?: string
  }) => ipcRenderer.invoke("create-user", userData),
  getUserByToken: (token: string) =>
    ipcRenderer.invoke("get-user-by-token", token),
  updateUser: (
    userId: string,
    userData: { username?: string; name?: string }
  ) => ipcRenderer.invoke("update-user", userId, userData),
  updateUserPassword: (userId: string, newPassword: string) =>
    ipcRenderer.invoke("update-user-password", userId, newPassword),
  updateUserPasscode: (
    userId: string,
    passcode?: string,
    passcodeType?: string
  ) =>
    ipcRenderer.invoke("update-user-passcode", userId, passcode, passcodeType),
  verifyPasscode: (userId: string, passcode: string) =>
    ipcRenderer.invoke("verify-passcode", userId, passcode),

  // Auth token persistence (electron-store)
  saveAuthToken: (token: string) => ipcRenderer.invoke("auth:saveToken", token),
  getAuthToken: () => ipcRenderer.invoke("auth:getToken"),
  clearAuthToken: () => ipcRenderer.invoke("auth:clearToken"),
  getAuthStoreStatus: () => ipcRenderer.invoke("auth:getStoreStatus"),

  // Student answer related
  uploadStudentAnswers: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      studentId?: string
      pageNumber?: number
      overwrite?: boolean
    }[]
  ) => ipcRenderer.invoke("upload-answer-sheets", projectId, filesData),
  getStudentAnswersByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-answer-sheets-by-project-id", projectId),
  deleteStudentAnswer: (answerSheetId: string) =>
    ipcRenderer.invoke("delete-answer-sheet", answerSheetId),
  associateStudentAnswerWithStudent: (
    answerSheetId: string,
    studentId: string
  ) =>
    ipcRenderer.invoke(
      "associate-answer-sheet-with-student",
      answerSheetId,
      studentId
    ),
  setStudentAnswerAbsent: (answerSheetId: string, isAbsent: boolean) =>
    ipcRenderer.invoke("set-answer-sheet-absent", answerSheetId, isAbsent),
  getStudentAnswerById: (answerSheetId: string) =>
    ipcRenderer.invoke("get-answer-sheet-by-id", answerSheetId),
  updateStudentAnswerPlacement: (
    answerSheetId: string,
    studentId: string | null,
    pageNumber: number
  ) =>
    ipcRenderer.invoke(
      "update-answer-sheet-placement",
      answerSheetId,
      studentId,
      pageNumber
    ),
  swapStudentAnswerPlacements: (
    answerSheetId1: string,
    answerSheetId2: string
  ) =>
    ipcRenderer.invoke(
      "swap-answer-sheet-placements",
      answerSheetId1,
      answerSheetId2
    ),
  swapStudentAnswerPlacementsWithScoring: (
    answerSheetId1: string,
    answerSheetId2: string
  ) =>
    ipcRenderer.invoke(
      "swap-answer-sheet-placements-with-scoring",
      answerSheetId1,
      answerSheetId2
    ),
  batchUpdateStudentAnswerPlacements: (
    moves: Array<{
      fileId: string
      finalStudentId: string | null
      finalPageNumber: number
    }>,
    withScoring: boolean
  ) =>
    ipcRenderer.invoke(
      "batch-update-answer-sheet-placements",
      moves,
      withScoring
    ),
  getImageData: (relativePath: string) =>
    ipcRenderer.invoke("get-image-data", relativePath),
  getAssetPath: (assetPath: string) =>
    ipcRenderer.invoke("get-asset-path", assetPath),

  // Class related
  fetchClasses: () => ipcRenderer.invoke("fetch-classes"),
  createClass: (classData: Prisma.ClassCreateInput) =>
    ipcRenderer.invoke("create-class", classData),
  updateClass: (classData: Prisma.ClassUpdateInput & { id: string }) =>
    ipcRenderer.invoke("update-class", classData),
  deleteClass: (classId: string) => ipcRenderer.invoke("delete-class", classId),

  // Student related
  fetchStudents: () => ipcRenderer.invoke("fetch-students"),
  createStudent: (studentData: Prisma.StudentCreateInput) =>
    ipcRenderer.invoke("create-student", studentData),
  updateStudent: (id: string, studentData: Prisma.StudentUpdateInput) =>
    ipcRenderer.invoke("update-student", id, studentData),
  deleteStudent: (id: string) => ipcRenderer.invoke("delete-student", id),
  getStudentExamResults: (studentId: string) =>
    ipcRenderer.invoke("get-student-exam-results", studentId),

  // Student Class Membership related
  createStudentClassMembership: (
    membershipData: Prisma.StudentClassMembershipCreateInput
  ) => ipcRenderer.invoke("create-student-class-membership", membershipData),
  updateStudentClassMembership: (
    id: string,
    membershipData: Prisma.StudentClassMembershipUpdateInput
  ) =>
    ipcRenderer.invoke("update-student-class-membership", id, membershipData),
  deleteStudentClassMembership: (id: string) =>
    ipcRenderer.invoke("delete-student-class-membership", id),
  getCurrentMembershipsByStudentId: (studentId: string) =>
    ipcRenderer.invoke("get-current-memberships-by-student-id", studentId),
  getAllMembershipsByStudentId: (studentId: string) =>
    ipcRenderer.invoke("get-all-memberships-by-student-id", studentId),
  getCurrentMembershipsByClassId: (classId: string) =>
    ipcRenderer.invoke("get-current-memberships-by-class-id", classId),
  addStudentToClass: (
    studentId: string,
    classId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string
  ) =>
    ipcRenderer.invoke(
      "add-student-to-class",
      studentId,
      classId,
      startDate,
      attendanceNumber,
      notes
    ),
  endStudentMembership: (membershipId: string, endDate?: Date) =>
    ipcRenderer.invoke("end-student-membership", membershipId, endDate),
  getMembershipsByDateRange: (startDate: Date, endDate?: Date) =>
    ipcRenderer.invoke("get-memberships-by-date-range", startDate, endDate),

  // MasterAnswer related
  uploadMasterAnswers: (
    projectId: string,
    filesData: { name: string; type: string; buffer: ArrayBuffer }[]
  ) => ipcRenderer.invoke("upload-master-answers", projectId, filesData),
  deleteMasterAnswer: (answerId: string) =>
    ipcRenderer.invoke("delete-master-answer", answerId),
  updateMasterAnswersOrder: (
    answerOrders: { id: string; pageNumber: number }[]
  ) => ipcRenderer.invoke("update-master-answers-order", answerOrders),

  // New API to resolve file path for display
  resolveFileProtocolPath: (relativePath: string) =>
    ipcRenderer.invoke("resolve-file-protocol-path", relativePath),
  readFileAsBase64: (filePath: string) =>
    ipcRenderer.invoke("read-file-as-base64", filePath),
  checkFileExists: (relativePath: string) =>
    ipcRenderer.invoke("check-file-exists", relativePath),
  getMasterImagesByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-master-images-by-project-id", projectId),
  getProjectPagesByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-project-pages-by-project-id", projectId),
  // CropRegion functions (renamed from LayoutRegion)
  createCropRegion: (data: CropRegionCreateData) =>
    ipcRenderer.invoke("create-crop-region", data),
  createManyCropRegions: (data: Prisma.CropRegionCreateManyInput[]) =>
    ipcRenderer.invoke("create-many-crop-regions", data),
  updateCropRegion: (id: string, data: CropRegionUpdateData) =>
    ipcRenderer.invoke("update-crop-region", id, data),
  deleteCropRegion: (id: string) =>
    ipcRenderer.invoke("delete-crop-region", id),
  getCropRegionsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-crop-regions-by-project-id", projectId),
  getQuestionAnswerRegionsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-question-answer-regions-by-project-id", projectId),
  getCropRegionById: (id: string) =>
    ipcRenderer.invoke("get-crop-region-by-id", id),
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => ipcRenderer.invoke("update-crop-region-orders", updates),

  // Project-Student relationship
  getStudentsForProject: (projectId: string) =>
    ipcRenderer.invoke("get-students-for-project", projectId),
  addStudentsToProject: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke("add-students-to-project", projectId, studentIds),
  removeStudentsFromProject: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke("remove-students-from-project", projectId, studentIds),
  updateStudentProjectStatus: (
    projectId: string,
    studentId: string,
    status: "participating" | "expected" | "absent"
  ) =>
    ipcRenderer.invoke(
      "update-student-project-status",
      projectId,
      studentId,
      status
    ),
  checkGradingDataForStudents: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke(
      "check-grading-data-for-students",
      projectId,
      studentIds
    ),
  getClassesNotInProject: (projectId: string) =>
    ipcRenderer.invoke("get-classes-not-in-project", projectId),
  getStudentsNotInProject: (projectId: string) =>
    ipcRenderer.invoke("get-students-not-in-project", projectId),
  updateStudentOrders: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => ipcRenderer.invoke("update-student-orders", projectId, studentOrders),

  // QuestionScore related functions
  getQuestionScoresForProject: (projectId: string, userId?: string) =>
    ipcRenderer.invoke("get-question-scores-for-project", projectId, userId),
  getQuestionScoresForAnswerSheet: (answerSheetId: string) =>
    ipcRenderer.invoke("get-question-scores-for-answer-sheet", answerSheetId),
  createQuestionScore: (data: QuestionScoreCreateData) =>
    ipcRenderer.invoke("create-question-score", data),
  updateQuestionScore: (
    id: string,
    data: QuestionScoreUpdateData,
    expectedVersion: number
  ) => ipcRenderer.invoke("update-question-score", id, data, expectedVersion),
  deleteQuestionScore: (id: string) =>
    ipcRenderer.invoke("delete-question-score", id),
  getQuestionScoreComparison: (answerSheetId: string, cropRegionId: string) =>
    ipcRenderer.invoke(
      "get-question-score-comparison",
      answerSheetId,
      cropRegionId
    ),
  finalizeQuestionScore: (
    answerSheetId: string,
    cropRegionId: string,
    userId: string,
    scoreData: QuestionScoreUpdateData
  ) =>
    ipcRenderer.invoke(
      "finalize-question-score",
      answerSheetId,
      cropRegionId,
      userId,
      scoreData
    ),
  getAnswerSheetProgress: (answerSheetId: string) =>
    ipcRenderer.invoke("get-answer-sheet-progress", answerSheetId),
  getProjectProgress: (projectId: string) =>
    ipcRenderer.invoke("get-project-progress", projectId),
  initializeScoringRecords: (projectId: string) =>
    ipcRenderer.invoke("initialize-scoring-records", projectId),

  // SubtotalGroup related (new management API with correct parameter format)
  createSubtotalGroup: (data: {
    name: string
    subtotals: { name: string; order: number }[]
  }) => ipcRenderer.invoke("create-subtotal-group", data),
  updateSubtotalGroup: (
    id: string,
    data: { name: string; subtotals: { name: string; order: number }[] }
  ) => ipcRenderer.invoke("update-subtotal-group", id, data),
  deleteSubtotalGroup: (id: string) =>
    ipcRenderer.invoke("delete-subtotal-group", id),
  getSubtotalGroupsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-subtotal-groups-by-project-id", projectId),
  getSubtotalGroupById: (id: string) =>
    ipcRenderer.invoke("get-subtotal-group-by-id", id),

  // New SubtotalGroup management API
  getSubtotalGroups: () => ipcRenderer.invoke("get-subtotal-groups"),
  getAvailableSubtotalGroupsForProject: (projectId: string) =>
    ipcRenderer.invoke("get-available-subtotal-groups-for-project", projectId),
  getActiveSubtotalGroupsForProject: (projectId: string) =>
    ipcRenderer.invoke("get-active-subtotal-groups-for-project", projectId),
  addSubtotalGroupToProject: (projectId: string, subtotalGroupId: string) =>
    ipcRenderer.invoke(
      "add-subtotal-group-to-project",
      projectId,
      subtotalGroupId
    ),
  removeSubtotalGroupFromProject: (
    projectId: string,
    subtotalGroupId: string
  ) =>
    ipcRenderer.invoke(
      "remove-subtotal-group-from-project",
      projectId,
      subtotalGroupId
    ),

  // Subtotal related (renamed from QuestionGroupItem)
  createSubtotal: (data: Prisma.SubtotalUncheckedCreateInput) =>
    ipcRenderer.invoke("create-subtotal", data),
  createManySubtotals: (items: Prisma.SubtotalUncheckedCreateInput[]) =>
    ipcRenderer.invoke("create-many-subtotals", items),
  updateSubtotal: (id: string, data: Prisma.SubtotalUpdateInput) =>
    ipcRenderer.invoke("update-subtotal", id, data),
  deleteSubtotal: (id: string) => ipcRenderer.invoke("delete-subtotal", id),
  getSubtotalsByGroupId: (subtotalGroupId: string) =>
    ipcRenderer.invoke("get-subtotals-by-group-id", subtotalGroupId),
  getSubtotalById: (id: string) => ipcRenderer.invoke("get-subtotal-by-id", id),

  // CropSubtotal related (unified from QuestionSubtotalAssignment + SubtotalDefinition)
  createCropSubtotal: (data: Prisma.CropSubtotalUncheckedCreateInput) =>
    ipcRenderer.invoke("create-crop-subtotal", data),
  createManyCropSubtotals: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => ipcRenderer.invoke("create-many-crop-subtotals", assignments),
  deleteCropSubtotal: (id: string) =>
    ipcRenderer.invoke("delete-crop-subtotal", id),
  deleteCropSubtotalsByCropRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("delete-crop-subtotals-by-crop-region-id", cropRegionId),
  getCropSubtotalsByCropRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
  getCropSubtotalsBySubtotalId: (subtotalId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),

  // 互換性関数（旧SubtotalDefinition用、CropSubtotalでの統合エイリアス）
  getSubtotalDefinitionsByCropRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke(
      "get-subtotal-definitions-by-crop-region-id",
      cropRegionId
    ),

  // 互換性関数（段階的移行のため古い名前も残す）
  createLayoutRegion: (data: CropRegionCreateData) =>
    ipcRenderer.invoke("create-crop-region", data),
  updateLayoutRegion: (id: string, data: CropRegionUpdateData) =>
    ipcRenderer.invoke("update-crop-region", id, data),
  deleteLayoutRegion: (id: string) =>
    ipcRenderer.invoke("delete-crop-region", id),
  getLayoutRegionsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-crop-regions-by-project-id", projectId),
  getLayoutRegionById: (id: string) =>
    ipcRenderer.invoke("get-crop-region-by-id", id),
  updateLayoutRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => ipcRenderer.invoke("update-crop-region-orders", updates),

  createQuestionGroup: (data: Prisma.SubtotalGroupUncheckedCreateInput) =>
    ipcRenderer.invoke("create-subtotal-group", data),
  updateQuestionGroup: (id: string, data: Prisma.SubtotalGroupUpdateInput) =>
    ipcRenderer.invoke("update-subtotal-group", id, data),
  deleteQuestionGroup: (id: string) =>
    ipcRenderer.invoke("delete-subtotal-group", id),
  getQuestionGroupsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-subtotal-groups-by-project-id", projectId),
  getQuestionGroupById: (id: string) =>
    ipcRenderer.invoke("get-subtotal-group-by-id", id),

  createQuestionGroupItem: (data: Prisma.SubtotalUncheckedCreateInput) =>
    ipcRenderer.invoke("create-subtotal", data),
  createManyQuestionGroupItems: (
    items: Prisma.SubtotalUncheckedCreateInput[]
  ) => ipcRenderer.invoke("create-many-subtotals", items),
  updateQuestionGroupItem: (id: string, data: Prisma.SubtotalUpdateInput) =>
    ipcRenderer.invoke("update-subtotal", id, data),
  deleteQuestionGroupItem: (id: string) =>
    ipcRenderer.invoke("delete-subtotal", id),
  getQuestionGroupItemsByGroupId: (subtotalGroupId: string) =>
    ipcRenderer.invoke("get-subtotals-by-group-id", subtotalGroupId),
  getQuestionGroupItemById: (id: string) =>
    ipcRenderer.invoke("get-subtotal-by-id", id),
  updateQuestionGroupItemOrders: (orders: { id: string; order: number }[]) =>
    ipcRenderer.invoke("update-subtotal-orders", orders),

  createQuestionSubtotalAssignment: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => ipcRenderer.invoke("create-crop-subtotal", data),
  createManyQuestionSubtotalAssignments: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => ipcRenderer.invoke("create-many-crop-subtotals", assignments),
  deleteQuestionSubtotalAssignment: (id: string) =>
    ipcRenderer.invoke("delete-crop-subtotal", id),
  deleteAssignmentsByQuestionCropRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("delete-crop-subtotals-by-crop-region-id", cropRegionId),
  deleteAssignmentsByQuestionGroupItemId: (subtotalId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),
  getAssignmentsByQuestionCropRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
  getAssignmentsByQuestionGroupItemId: (subtotalId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),

  createSubtotalDefinition: (data: Prisma.CropSubtotalUncheckedCreateInput) =>
    ipcRenderer.invoke("create-crop-subtotal", data),
  createManySubtotalDefinitions: (
    definitions: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => ipcRenderer.invoke("create-many-crop-subtotals", definitions),
  deleteSubtotalDefinition: (id: string) =>
    ipcRenderer.invoke("delete-crop-subtotal", id),
  deleteSubtotalDefinitionsByLayoutRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("delete-crop-subtotals-by-crop-region-id", cropRegionId),
  getSubtotalDefinitionsByLayoutRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
  getSubtotalDefinitionsByQuestionGroupItemId: (subtotalId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),

  // Canvas描画エンジン用PDF出力API
  export: {
    getPdfExportData: (options: {
      projectId: string
      selectedStudentIds: string[]
    }) => ipcRenderer.invoke("export:getPdfExportData", options),
    createPdfFromRenderedImages: (options: {
      projectId: string
      renderedPages: Array<{
        studentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>
      pdfOrientation?: "portrait" | "landscape"
      outputPath?: string
    }) => ipcRenderer.invoke("export:createPdfFromRenderedImages", options),
    convertSvgToPng: (options: {
      svgString: string
      width?: number
      height?: number
    }) => ipcRenderer.invoke("export:convertSvgToPng", options),
    selectPdfSavePath: (options: { projectName?: string }) =>
      ipcRenderer.invoke("export:selectPdfSavePath", options),
    // ストリーミングPDF生成API
    createPdfStreamingSession: (options: {
      totalPages: number
      pdfOrientation?: "portrait" | "landscape"
    }) => ipcRenderer.invoke("export:createPdfStreamingSession", options),
    addPageToStreamingSession: (options: {
      sessionId: string
      pageIndex: number
      imageData: ArrayBuffer
    }) => ipcRenderer.invoke("export:addPageToStreamingSession", options),
    finalizeStreamingSession: (options: {
      sessionId: string
      outputPath: string
    }) => ipcRenderer.invoke("export:finalizeStreamingSession", options),
    cancelStreamingSession: (sessionId: string) =>
      ipcRenderer.invoke("export:cancelStreamingSession", sessionId),
    // 個人成績表PDF API
    getIndividualReportData: (options: {
      projectId: string
      selectedStudentIds: string[]
      options: import("./lib/export/individual-report").IndividualReportOptions
    }) => ipcRenderer.invoke("export:getIndividualReportData", options),
    getSubtotalGroupsForReport: (projectId: string) =>
      ipcRenderer.invoke("export:getSubtotalGroupsForReport", projectId),
    selectIndividualReportSavePath: (options: { projectName?: string }) =>
      ipcRenderer.invoke("export:selectIndividualReportSavePath", options),
    saveIndividualReportPdf: (options: {
      filePath: string
      pdfBuffer: ArrayBuffer
    }) => ipcRenderer.invoke("export:saveIndividualReportPdf", options),
    // HTML to PDF (ブラウザ印刷機能)
    printHtmlToPdf: (options: {
      html: string
      filePath: string
      pageSize?: "A4" | "Letter"
      landscape?: boolean
      margins?: {
        top?: number
        bottom?: number
        left?: number
        right?: number
      }
    }) => ipcRenderer.invoke("export:printHtmlToPdf", options),
    printMultipleHtmlToPdf: (options: {
      htmlPages: string[]
      filePath: string
      pageSize?: "A4" | "Letter"
      landscape?: boolean
    }) => ipcRenderer.invoke("export:printMultipleHtmlToPdf", options),
    // Excelプレビューデータ取得
    getExcelPreviewData: (options: {
      projectId: string
      selectedStudentIds: string[]
    }) => ipcRenderer.invoke("export:getExcelPreviewData", options),
    // 印刷ダイアログを開く
    openPrintDialog: (options: { html: string; title?: string }) =>
      ipcRenderer.invoke("export:openPrintDialog", options),
  },

  // Excel Export related
  exportGradingDataExcel: (options: {
    projectId: string
    selectedStudentIds: string[]
    outputPath?: string
  }) => ipcRenderer.invoke("export-grading-data-excel", options),

  // Data management related
  getDataDirectoryInfo: () => ipcRenderer.invoke("get-data-directory-info"),
  openDataDirectory: () => ipcRenderer.invoke("open-data-directory"),
  deleteAllData: () => ipcRenderer.invoke("delete-all-data"),

  // Progress listeners
  onExportProgress: (
    callback: (progress: {
      current: number
      total: number
      step: string
      percentage: number
    }) => void
  ) => {
    ipcRenderer.on("export-progress", (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners("export-progress")
  },

  // Drawing Annotation related
  drawing: {
    create: (data: Partial<DrawingAnnotation>) =>
      ipcRenderer.invoke("drawing:create", data),
    getByQuestionScore: (
      questionScoreId: string,
      type?: string,
      userId?: string
    ) =>
      ipcRenderer.invoke(
        "drawing:getByQuestionScore",
        questionScoreId,
        type,
        userId
      ),
    getByStudent: (
      studentId: string,
      projectId: string,
      type?: string,
      userId?: string
    ) =>
      ipcRenderer.invoke(
        "drawing:getByStudent",
        studentId,
        projectId,
        type,
        userId
      ),
    getByProject: (projectId: string, type?: string, userId?: string) =>
      ipcRenderer.invoke("drawing:getByProject", projectId, type, userId),
    update: (id: string, data: Partial<DrawingAnnotation>) =>
      ipcRenderer.invoke("drawing:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("drawing:delete", id),
    deleteByQuestionScore: (questionScoreId: string, type?: string) =>
      ipcRenderer.invoke(
        "drawing:deleteByQuestionScore",
        questionScoreId,
        type
      ),
    batchCreate: (annotations: Partial<DrawingAnnotation>[]) =>
      ipcRenderer.invoke("drawing:batchCreate", annotations),
    batchUpdate: (
      updates: Array<{ id: string; data: Partial<DrawingAnnotation> }>
    ) => ipcRenderer.invoke("drawing:batchUpdate", updates),
    getStats: (questionScoreId: string) =>
      ipcRenderer.invoke("drawing:getStats", questionScoreId),
    getById: (id: string) => ipcRenderer.invoke("drawing:getById", id),
  },

  // Project Archive (Export/Import) related
  archive: {
    exportProject: (options: {
      projectId: string
      userId: string
      outputPath?: string
      exportMode?: import("../types/projectArchive.types").ExportMode
    }) => ipcRenderer.invoke("archive:exportProject", options),
    analyzeArchive: (options: { archivePath: string }) =>
      ipcRenderer.invoke("archive:analyzeArchive", options),
    preMatch: (options: { archivePath: string }) =>
      ipcRenderer.invoke("archive:preMatch", options),
    detectConflicts: (options: {
      archivePath: string
      matchingConfig: import("../types/projectArchive.types").MatchingConfig
    }) => ipcRenderer.invoke("archive:detectConflicts", options),
    idIntegrationImport: (options: {
      archivePath: string
      preMatchResult: import("../types/projectArchive.types").FileOverviewData
      integrationConfig: import("../types/projectArchive.types").IdIntegrationConfig
      currentUserId: string
      scoringConflictConfig?: import("../types/projectArchive.types").ScoringConflictConfig
      updateDecisions?: import("../types/projectArchive.types").UpdateDecisions
    }) => ipcRenderer.invoke("archive:idIntegrationImport", options),
    detectScoringConflicts: (options: {
      archivePath: string
      preMatchResult: import("../types/projectArchive.types").FileOverviewData
      integrationConfig: import("../types/projectArchive.types").IdIntegrationConfig
    }) => ipcRenderer.invoke("archive:detectScoringConflicts", options),
    bulkExportProjects: (options: {
      projectIds: string[]
      userId: string
      exportMode?: import("../types/projectArchive.types").ExportMode
    }) => ipcRenderer.invoke("archive:bulkExportProjects", options),
    selectImportFile: () => ipcRenderer.invoke("archive:selectImportFile"),
    convertHszToScore: (options: { hszPath: string }) =>
      ipcRenderer.invoke("archive:convertHszToScore", options),
  },

  // ProjectClass
  projectClass: {
    getAll: (projectId: string) =>
      ipcRenderer.invoke("project-class:get-all", projectId),
    getAdministered: (projectId: string) =>
      ipcRenderer.invoke("project-class:get-administered", projectId),
    getStatistics: (projectId: string) =>
      ipcRenderer.invoke("project-class:get-statistics", projectId),
    getAvailable: (projectId: string) =>
      ipcRenderer.invoke("project-class:get-available", projectId),
    add: (options: {
      projectId: string
      classId: string
      administered?: boolean
      statistics?: boolean
    }) => ipcRenderer.invoke("project-class:add", options),
    update: (options: {
      id: string
      administered?: boolean
      statistics?: boolean
      order?: number
    }) => ipcRenderer.invoke("project-class:update", options),
    remove: (id: string) => ipcRenderer.invoke("project-class:remove", id),
    reorder: (options: { projectId: string; orderedIds: string[] }) =>
      ipcRenderer.invoke("project-class:reorder", options),
    removeByIds: (projectId: string, classId: string) =>
      ipcRenderer.invoke("project-class:remove-by-ids", projectId, classId),
    addStudentsFromClass: (projectId: string, classId: string) =>
      ipcRenderer.invoke(
        "project-class:add-students-from-class",
        projectId,
        classId
      ),
    getStudentClassInfo: (projectId: string) =>
      ipcRenderer.invoke("project-class:get-student-class-info", projectId),
    getStudentClassInfoSingle: (projectId: string, studentId: string) =>
      ipcRenderer.invoke(
        "project-class:get-student-class-info-single",
        projectId,
        studentId
      ),
  },

  // UserProject
  userProject: {
    getMembers: (projectId: string) =>
      ipcRenderer.invoke("user-project:get-members", projectId),
    getRole: (userId: string, projectId: string) =>
      ipcRenderer.invoke("user-project:get-role", userId, projectId),
    isOwner: (userId: string, projectId: string) =>
      ipcRenderer.invoke("user-project:is-owner", userId, projectId),
    isMember: (userId: string, projectId: string) =>
      ipcRenderer.invoke("user-project:is-member", userId, projectId),
    setOwner: (options: { projectId: string; userId: string }) =>
      ipcRenderer.invoke("user-project:set-owner", options),
    invite: (options: {
      projectId: string
      userId: string
      invitedBy: string
    }) => ipcRenderer.invoke("user-project:invite", options),
    remove: (projectId: string, userId: string, removedBy: string) =>
      ipcRenderer.invoke("user-project:remove", projectId, userId, removedBy),
    transferOwnership: (
      projectId: string,
      newOwnerId: string,
      currentOwnerId: string
    ) =>
      ipcRenderer.invoke(
        "user-project:transfer-ownership",
        projectId,
        newOwnerId,
        currentOwnerId
      ),
    getUserProjects: (userId: string) =>
      ipcRenderer.invoke("user-project:get-user-projects", userId),
    getOwner: (projectId: string) =>
      ipcRenderer.invoke("user-project:get-owner", projectId),
    searchUsers: (projectId: string, query: string) =>
      ipcRenderer.invoke("user-project:search-users", projectId, query),
  },

  // Settings
  settings: {
    // UserKeyboardShortcut
    getUserKeyboardShortcuts: (userId: string) =>
      ipcRenderer.invoke("settings:getUserKeyboardShortcuts", userId),
    saveUserKeyboardShortcuts: (
      userId: string,
      shortcuts: Record<string, string>
    ) =>
      ipcRenderer.invoke(
        "settings:saveUserKeyboardShortcuts",
        userId,
        shortcuts
      ),
    resetUserKeyboardShortcuts: (userId: string) =>
      ipcRenderer.invoke("settings:resetUserKeyboardShortcuts", userId),

    // UserScoringPreference
    getUserScoringPreference: (userId: string) =>
      ipcRenderer.invoke("settings:getUserScoringPreference", userId),
    upsertUserScoringPreference: (
      userId: string,
      data: {
        showStudentNames?: boolean
        autoScroll?: boolean
        itemsPerLine?: number
        layoutDirection?: string
        expandMargin?: number
        selectionBorderColor?: string | null
        scoringStatusColors?: string | null
        scoringColorPresetId?: string | null
      }
    ) =>
      ipcRenderer.invoke("settings:upsertUserScoringPreference", userId, data),

    // カラム別操作（楽観的更新対応）
    getScoringPreferenceColumn: (
      userId: string,
      column:
        | "showStudentNames"
        | "autoScroll"
        | "itemsPerLine"
        | "layoutDirection"
        | "expandMargin"
        | "selectionBorderColor"
        | "scoringStatusColors"
        | "scoringColorPresetId"
    ) =>
      ipcRenderer.invoke("settings:getScoringPreferenceColumn", userId, column),
    setScoringPreferenceColumn: (
      userId: string,
      column:
        | "showStudentNames"
        | "autoScroll"
        | "itemsPerLine"
        | "layoutDirection"
        | "expandMargin"
        | "selectionBorderColor"
        | "scoringStatusColors"
        | "scoringColorPresetId",
      value: boolean | number | string | null
    ) =>
      ipcRenderer.invoke(
        "settings:setScoringPreferenceColumn",
        userId,
        column,
        value
      ),

    // ProjectMarkingFormat
    getProjectMarkingFormats: (projectId: string) =>
      ipcRenderer.invoke("settings:getProjectMarkingFormats", projectId),
    saveProjectMarkingFormats: (
      projectId: string,
      formats: Array<{
        markType: string
        symbol: string
        color: string
        fontSize?: number | null
        strokeWidth?: number | null
      }>
    ) =>
      ipcRenderer.invoke(
        "settings:saveProjectMarkingFormats",
        projectId,
        formats
      ),

    // ProjectExportSettings
    getProjectExportSettings: (projectId: string) =>
      ipcRenderer.invoke("settings:getProjectExportSettings", projectId),
    saveProjectExportSettings: (
      projectId: string,
      settings: Record<string, unknown>
    ) =>
      ipcRenderer.invoke(
        "settings:saveProjectExportSettings",
        projectId,
        settings
      ),

    // CropRegionMarkingOverride (機能H)
    getCropRegionMarkingOverrides: (cropRegionId: string) =>
      ipcRenderer.invoke(
        "settings:getCropRegionMarkingOverrides",
        cropRegionId
      ),
    saveCropRegionMarkingOverrides: (
      cropRegionId: string,
      overrides: Array<{
        markType: string
        symbol?: string | null
        color?: string | null
        visible?: boolean
      }>
    ) =>
      ipcRenderer.invoke(
        "settings:saveCropRegionMarkingOverrides",
        cropRegionId,
        overrides
      ),
    resetCropRegionMarkingOverrides: (cropRegionId: string) =>
      ipcRenderer.invoke(
        "settings:resetCropRegionMarkingOverrides",
        cropRegionId
      ),
    getProjectCropRegionMarkingOverrides: (projectId: string) =>
      ipcRenderer.invoke(
        "settings:getProjectCropRegionMarkingOverrides",
        projectId
      ),
  },

  // PDF Tools related
  pdfTools: {
    mergePdfs: (options: {
      pages: Array<{
        filePath: string
        pageNumber: number
        rotation?: 0 | 90 | 180 | 270
        // 2-in-1用
        isNUpCombined?: boolean
        combinedPages?: number[]
        nUpLayout?: "2x1" | "1x2"
      }>
      outputPath: string
    }) => ipcRenderer.invoke("pdf-tools:merge-pdfs", options),
    splitPdf: (options: {
      filePath: string
      outputDir: string
      prefix?: string
    }) => ipcRenderer.invoke("pdf-tools:split-pdf", options),
    applyNUp: (options: {
      filePath: string
      layout: "2x1" | "1x2"
      order: "left-right" | "right-left"
      outputPath: string
    }) => ipcRenderer.invoke("pdf-tools:apply-nup", options),
    rotatePages: (options: {
      filePath: string
      rotations: Array<{ pageNumber: number; rotation: 0 | 90 | 180 | 270 }>
      outputPath: string
    }) => ipcRenderer.invoke("pdf-tools:rotate-pages", options),
    exportAsPng: (options: {
      imageBuffers: Array<{
        buffer: Buffer
        name: string
        rotation?: 0 | 90 | 180 | 270
      }>
      outputDir: string
    }) => ipcRenderer.invoke("pdf-tools:export-as-png", options),
    selectSavePath: (options: {
      type: "pdf" | "directory"
      defaultName?: string
    }) => ipcRenderer.invoke("pdf-tools:select-save-path", options),
    selectFiles: () =>
      ipcRenderer.invoke("pdf-tools:select-files") as Promise<{
        success: boolean
        filePaths?: string[]
        canceled?: boolean
      }>,
    getPdfInfo: (filePath: string) =>
      ipcRenderer.invoke("pdf-tools:get-pdf-info", filePath) as Promise<{
        success: boolean
        pageCount?: number
        name?: string
        error?: string
      }>,
    // ドラッグ&ドロップされたFileオブジェクトからパスを取得
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
  },

  // =============================================================================
  // GradeProject（成績算出）
  // =============================================================================
  gradeProject: {
    getAll: () => ipcRenderer.invoke("grade-project:getAll"),
    getById: (id: string) => ipcRenderer.invoke("grade-project:getById", id),
    create: (data: {
      name: string
      description?: string
      referenceDate?: string | null
    }) => ipcRenderer.invoke("grade-project:create", data),
    update: (
      id: string,
      data: {
        name?: string
        description?: string
        referenceDate?: string | null
      }
    ) => ipcRenderer.invoke("grade-project:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("grade-project:delete", id),
    // 生徒・学級管理
    getStudents: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:getStudents", gradeProjectId),
    getClasses: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:getClasses", gradeProjectId),
    getAvailableClasses: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:getAvailableClasses", gradeProjectId),
    addStudentsFromClass: (gradeProjectId: string, classId: string) =>
      ipcRenderer.invoke(
        "grade-project:addStudentsFromClass",
        gradeProjectId,
        classId
      ),
    removeClass: (gradeProjectId: string, classId: string) =>
      ipcRenderer.invoke("grade-project:removeClass", gradeProjectId, classId),
    updateStudentOrders: (
      gradeProjectId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) =>
      ipcRenderer.invoke(
        "grade-project:updateStudentOrders",
        gradeProjectId,
        studentOrders
      ),
    // GradeItem
    getGradeItems: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:getGradeItems", gradeProjectId),
    createGradeItem: (data: { gradeProjectId: string; name: string }) =>
      ipcRenderer.invoke("grade-project:createGradeItem", data),
    updateGradeItem: (id: string, data: { name?: string }) =>
      ipcRenderer.invoke("grade-project:updateGradeItem", id, data),
    deleteGradeItem: (id: string) =>
      ipcRenderer.invoke("grade-project:deleteGradeItem", id),
    reorderGradeItems: (items: { id: string; order: number }[]) =>
      ipcRenderer.invoke("grade-project:reorderGradeItems", items),
    // データソース
    createDataSource: (data: {
      gradeItemId: string
      type: string
      examProjectId?: string
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
    }) => ipcRenderer.invoke("grade-project:createDataSource", data),
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
    ) => ipcRenderer.invoke("grade-project:updateDataSource", id, data),
    deleteDataSource: (id: string) =>
      ipcRenderer.invoke("grade-project:deleteDataSource", id),
    reorderDataSources: (items: { id: string; order: number }[]) =>
      ipcRenderer.invoke("grade-project:reorderDataSources", items),
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
        "grade-project:batchUpdateAbsentPolicy",
        dataSourceIds,
        policy
      ),
    getManualScores: (gradeDataSourceId: string) =>
      ipcRenderer.invoke("grade-project:getManualScores", gradeDataSourceId),
    batchUpsertManualScores: (
      scores: {
        gradeDataSourceId: string
        studentId: string
        score: number | null
      }[]
    ) => ipcRenderer.invoke("grade-project:batchUpsertManualScores", scores),
    getBoundarySets: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:getBoundarySets", gradeProjectId),
    upsertBoundarySet: (data: {
      gradeProjectId: string
      targetType: string
      gradeItemId: string | null
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => ipcRenderer.invoke("grade-project:upsertBoundarySet", data),
    deleteBoundarySet: (id: string) =>
      ipcRenderer.invoke("grade-project:deleteBoundarySet", id),
    upsertGradeOverride: (data: {
      gradeProjectId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
      overrideLabel: string
    }) => ipcRenderer.invoke("grade-project:upsertGradeOverride", data),
    deleteGradeOverride: (data: {
      gradeProjectId: string
      studentId: string
      targetType: string
      gradeItemId: string | null
    }) => ipcRenderer.invoke("grade-project:deleteGradeOverride", data),
    getGradeItemExclusions: (gradeProjectId: string) =>
      ipcRenderer.invoke(
        "grade-project:getGradeItemExclusions",
        gradeProjectId
      ),
    setGradeItemExclusion: (data: {
      gradeProjectId: string
      studentId: string
      gradeItemId: string
      excluded: boolean
    }) => ipcRenderer.invoke("grade-project:setGradeItemExclusion", data),
    batchUpdateGradeItemExclusions: (
      gradeProjectId: string,
      updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
    ) =>
      ipcRenderer.invoke(
        "grade-project:batchUpdateGradeItemExclusions",
        gradeProjectId,
        updates
      ),
    calculateGrades: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:calculateGrades", gradeProjectId),
    getExamProjectCandidates: () =>
      ipcRenderer.invoke("grade-project:getExamProjectCandidates"),
    getProjectSubtotalGroups: (projectId: string) =>
      ipcRenderer.invoke("grade-project:getProjectSubtotalGroups", projectId),
    getProjectCropRegions: (projectId: string) =>
      ipcRenderer.invoke("grade-project:getProjectCropRegions", projectId),
    calculateSourceMaxScore: (data: {
      type: string
      examProjectId?: string
      subtotalId?: string
      cropRegionId?: string
    }) => ipcRenderer.invoke("grade-project:calculateSourceMaxScore", data),
    exportExcel: (
      gradeProjectId: string,
      options?: { studentIds?: string[] }
    ) =>
      ipcRenderer.invoke("grade-project:exportExcel", gradeProjectId, options),
    getExportSettings: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:getExportSettings", gradeProjectId),
    saveExportSettings: (
      gradeProjectId: string,
      settings: Record<string, unknown>
    ) =>
      ipcRenderer.invoke(
        "grade-project:saveExportSettings",
        gradeProjectId,
        settings
      ),
    exportArchive: (gradeProjectId: string) =>
      ipcRenderer.invoke("grade-project:exportArchive", gradeProjectId),
    importArchive: () => ipcRenderer.invoke("grade-project:importArchive"),
    executeImport: (
      archiveData: unknown,
      examProjectMapping?: Record<string, string>
    ) =>
      ipcRenderer.invoke(
        "grade-project:executeImport",
        archiveData,
        examProjectMapping
      ),
  },

  // =============================================================================
  // Subject（教科）
  // =============================================================================
  subjectGetAll: () => ipcRenderer.invoke("subject:getAll"),
  subjectGetById: (id: string) => ipcRenderer.invoke("subject:getById", id),
  subjectCreate: (data: { name: string }) =>
    ipcRenderer.invoke("subject:create", data),
  subjectUpdate: (id: string, data: { name: string }) =>
    ipcRenderer.invoke("subject:update", id, data),
  subjectDelete: (id: string) => ipcRenderer.invoke("subject:delete", id),

  // =============================================================================
  // SubjectSubtotalGroup（教科-小計グループ関連）
  // =============================================================================
  subjectSubtotalGroupGetBySubjectId: (subjectId: string) =>
    ipcRenderer.invoke("subjectSubtotalGroup:getBySubjectId", subjectId),
  subjectSubtotalGroupCreate: (data: {
    subjectId: string
    subtotalGroupId: string
  }) => ipcRenderer.invoke("subjectSubtotalGroup:create", data),
  subjectSubtotalGroupDelete: (id: string) =>
    ipcRenderer.invoke("subjectSubtotalGroup:delete", id),

  // =============================================================================
  // Answer Sheet Builder（解答用紙作成）
  // =============================================================================
  answerSheetBuilder: {
    listDefinitions: () => ipcRenderer.invoke("asb:list-definitions"),
    loadDefinition: (id: string) =>
      ipcRenderer.invoke("asb:load-definition", id),
    saveDefinition: (
      definition: import("../types/answerSheetBuilder.types").AnswerSheetDefinition
    ) => ipcRenderer.invoke("asb:save-definition", definition),
    deleteDefinition: (id: string) =>
      ipcRenderer.invoke("asb:delete-definition", id),
    exportPdf: (
      args: import("../types/answerSheetBuilder.types").ASBExportPdfArgs
    ) => ipcRenderer.invoke("asb:export-pdf", args),
    exportPng: (
      args: import("../types/answerSheetBuilder.types").ASBExportPngArgs
    ) => ipcRenderer.invoke("asb:export-png", args),
    selectSavePath: (options: { type: "pdf" | "png"; defaultName?: string }) =>
      ipcRenderer.invoke("asb:select-save-path", options),
    convertToProject: (
      args: import("../types/answerSheetBuilder.types").ASBConvertToProjectArgs
    ) => ipcRenderer.invoke("asb:convert-to-project", args),
  },
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
