import { Prisma } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"
import { CreateProjectArgs } from "../types/electron"
import {
  CropRegionCreateData,
  CropRegionUpdateData,
  QuestionScoreCreateData,
  QuestionScoreUpdateData,
  ScoringMarkConfig,
} from "../types/common.types"

declare global {
  namespace NodeJS {
    interface Global {
      ipcRenderer: IpcRenderer
    }
  }
  var ipcRenderer: IpcRenderer
}

contextBridge.exposeInMainWorld("electronAPI", {
  fetchProjects: () => ipcRenderer.invoke("fetch-projects"),
  fetchProjectById: (projectId: string) =>
    ipcRenderer.invoke("fetch-project-by-id", projectId),
  createProject: (props: CreateProjectArgs, userId: string) => {
    return ipcRenderer.invoke("create-project", props, userId)
  },
  updateProject: (projectId: string, data: Prisma.ProjectUpdateInput) => {
    return ipcRenderer.invoke("update-project", projectId, data)
  },
  deleteProject: (
    projectId: string, // project オブジェクトではなく projectId を直接渡す
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
    userData: { username?: string; name?: string },
  ) => ipcRenderer.invoke("update-user", userId, userData),
  updateUserPassword: (userId: string, newPassword: string) =>
    ipcRenderer.invoke("update-user-password", userId, newPassword),
  updateUserPasscode: (
    userId: string,
    passcode?: string,
    passcodeType?: string,
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
    }[],
  ) => ipcRenderer.invoke("upload-answer-sheets", projectId, filesData),
  getStudentAnswersByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-answer-sheets-by-project-id", projectId),
  deleteStudentAnswer: (answerSheetId: string) =>
    ipcRenderer.invoke("delete-answer-sheet", answerSheetId),
  associateStudentAnswerWithStudent: (answerSheetId: string, studentId: string) =>
    ipcRenderer.invoke(
      "associate-answer-sheet-with-student",
      answerSheetId,
      studentId,
    ),
  setStudentAnswerAbsent: (answerSheetId: string, isAbsent: boolean) =>
    ipcRenderer.invoke("set-answer-sheet-absent", answerSheetId, isAbsent),
  getStudentAnswerById: (answerSheetId: string) =>
    ipcRenderer.invoke("get-answer-sheet-by-id", answerSheetId),
  updateStudentAnswerPlacement: (
    answerSheetId: string,
    studentId: string | null,
    pageNumber: number,
  ) =>
    ipcRenderer.invoke(
      "update-answer-sheet-placement",
      answerSheetId,
      studentId,
      pageNumber,
    ),
  swapStudentAnswerPlacements: (answerSheetId1: string, answerSheetId2: string) =>
    ipcRenderer.invoke(
      "swap-answer-sheet-placements",
      answerSheetId1,
      answerSheetId2,
    ),
  swapStudentAnswerPlacementsWithScoring: (
    answerSheetId1: string,
    answerSheetId2: string,
  ) =>
    ipcRenderer.invoke(
      "swap-answer-sheet-placements-with-scoring",
      answerSheetId1,
      answerSheetId2,
    ),
  batchUpdateStudentAnswerPlacements: (
    moves: Array<{
      fileId: string
      finalStudentId: string | null
      finalPageNumber: number
    }>,
    withScoring: boolean,
  ) =>
    ipcRenderer.invoke(
      "batch-update-answer-sheet-placements",
      moves,
      withScoring,
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
  importStudentsFromFile: (
    filePath: string,
    existingClasses: { id: string; name: string }[],
  ) =>
    ipcRenderer.invoke("import-students-from-file", filePath, existingClasses),

  // Student Class Membership related
  createStudentClassMembership: (
    membershipData: Prisma.StudentClassMembershipCreateInput,
  ) => ipcRenderer.invoke("create-student-class-membership", membershipData),
  updateStudentClassMembership: (
    id: string,
    membershipData: Prisma.StudentClassMembershipUpdateInput,
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
    notes?: string,
  ) =>
    ipcRenderer.invoke(
      "add-student-to-class",
      studentId,
      classId,
      startDate,
      attendanceNumber,
      notes,
    ),
  endStudentMembership: (membershipId: string, endDate?: Date) =>
    ipcRenderer.invoke("end-student-membership", membershipId, endDate),
  getMembershipsByDateRange: (startDate: Date, endDate?: Date) =>
    ipcRenderer.invoke("get-memberships-by-date-range", startDate, endDate),

  // MasterAnswer related
  uploadMasterAnswers: (
    projectId: string,
    filesData: { name: string; type: string; buffer: ArrayBuffer }[],
  ) => ipcRenderer.invoke("upload-master-answers", projectId, filesData),
  deleteMasterAnswer: (answerId: string) =>
    ipcRenderer.invoke("delete-master-answer", answerId),
  updateMasterAnswersOrder: (
    answerOrders: { id: string; pageNumber: number }[],
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
  getCropRegionById: (id: string) =>
    ipcRenderer.invoke("get-crop-region-by-id", id),
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>,
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
    status: "participating" | "expected" | "absent",
  ) =>
    ipcRenderer.invoke(
      "update-student-project-status",
      projectId,
      studentId,
      status,
    ),
  checkGradingDataForStudents: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke(
      "check-grading-data-for-students",
      projectId,
      studentIds,
    ),
  getClassesNotInProject: (projectId: string) =>
    ipcRenderer.invoke("get-classes-not-in-project", projectId),
  getStudentsNotInProject: (projectId: string) =>
    ipcRenderer.invoke("get-students-not-in-project", projectId),
  updateStudentOrders: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[],
  ) => ipcRenderer.invoke("update-student-orders", projectId, studentOrders),

  // QuestionScore related functions
  getQuestionScoresForProject: (projectId: string) =>
    ipcRenderer.invoke("get-question-scores-for-project", projectId),
  getQuestionScoresForAnswerSheet: (answerSheetId: string) =>
    ipcRenderer.invoke("get-question-scores-for-answer-sheet", answerSheetId),
  createQuestionScore: (data: QuestionScoreCreateData) =>
    ipcRenderer.invoke("create-question-score", data),
  updateQuestionScore: (
    id: string,
    data: QuestionScoreUpdateData,
    expectedVersion: number,
  ) => ipcRenderer.invoke("update-question-score", id, data, expectedVersion),
  deleteQuestionScore: (id: string) =>
    ipcRenderer.invoke("delete-question-score", id),
  getQuestionScoreComparison: (answerSheetId: string, cropRegionId: string) =>
    ipcRenderer.invoke(
      "get-question-score-comparison",
      answerSheetId,
      cropRegionId,
    ),
  finalizeQuestionScore: (
    answerSheetId: string,
    cropRegionId: string,
    scoredByUserId: string,
    scoreData: QuestionScoreUpdateData,
  ) =>
    ipcRenderer.invoke(
      "finalize-question-score",
      answerSheetId,
      cropRegionId,
      scoredByUserId,
      scoreData,
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
    data: { name: string; subtotals: { name: string; order: number }[] },
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
      subtotalGroupId,
    ),
  removeSubtotalGroupFromProject: (
    projectId: string,
    subtotalGroupId: string,
  ) =>
    ipcRenderer.invoke(
      "remove-subtotal-group-from-project",
      projectId,
      subtotalGroupId,
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
    assignments: Prisma.CropSubtotalUncheckedCreateInput[],
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
      cropRegionId,
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
    updates: Array<{ id: string; orderIndex: number }>,
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
    items: Prisma.SubtotalUncheckedCreateInput[],
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
    data: Prisma.CropSubtotalUncheckedCreateInput,
  ) => ipcRenderer.invoke("create-crop-subtotal", data),
  createManyQuestionSubtotalAssignments: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[],
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
    definitions: Prisma.CropSubtotalUncheckedCreateInput[],
  ) => ipcRenderer.invoke("create-many-crop-subtotals", definitions),
  deleteSubtotalDefinition: (id: string) =>
    ipcRenderer.invoke("delete-crop-subtotal", id),
  deleteSubtotalDefinitionsByLayoutRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("delete-crop-subtotals-by-crop-region-id", cropRegionId),
  getSubtotalDefinitionsByLayoutRegionId: (cropRegionId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-crop-region-id", cropRegionId),
  getSubtotalDefinitionsByQuestionGroupItemId: (subtotalId: string) =>
    ipcRenderer.invoke("get-crop-subtotals-by-subtotal-id", subtotalId),

  // PDF Export related
  exportScoredAnswersPDF: (options: {
    projectId: string
    selectedStudentIds: string[]
    outputPath?: string
    scoringMarkConfig?: ScoringMarkConfig
  }) => ipcRenderer.invoke("export-scored-answers-pdf", options),

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
    }) => void,
  ) => {
    ipcRenderer.on("export-progress", (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners("export-progress")
  },

  // Drawing Annotation related
  drawing: {
    create: (data: any) => ipcRenderer.invoke("drawing:create", data),
    getByQuestionScore: (questionScoreId: string, type?: string) => 
      ipcRenderer.invoke("drawing:getByQuestionScore", questionScoreId, type),
    getByStudent: (studentId: string, projectId: string, type?: string) =>
      ipcRenderer.invoke("drawing:getByStudent", studentId, projectId, type),
    getByProject: (projectId: string, type?: string) =>
      ipcRenderer.invoke("drawing:getByProject", projectId, type),
    update: (id: string, data: any) => ipcRenderer.invoke("drawing:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("drawing:delete", id),
    deleteByQuestionScore: (questionScoreId: string, type?: string) => 
      ipcRenderer.invoke("drawing:deleteByQuestionScore", questionScoreId, type),
    batchCreate: (annotations: any[]) => ipcRenderer.invoke("drawing:batchCreate", annotations),
    batchUpdate: (updates: any[]) => ipcRenderer.invoke("drawing:batchUpdate", updates),
    getStats: (questionScoreId: string) => ipcRenderer.invoke("drawing:getStats", questionScoreId),
    getById: (id: string) => ipcRenderer.invoke("drawing:getById", id),
  },
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
