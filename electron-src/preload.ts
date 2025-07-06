import { Prisma } from "@prisma/client"
import { contextBridge, ipcRenderer, IpcRenderer } from "electron"
import { CreateProjectArgs } from "../types/electron"
import { 
  LayoutRegionCreateData, 
  LayoutRegionUpdateData, 
  QuestionScoreCreateData, 
  QuestionScoreUpdateData, 
  ScoringMarkConfig 
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
  setShortcut: (page: string) => ipcRenderer.send("set-shortcut", page),
  sendScorePanel: (arg: string) => {
    ipcRenderer.send("score-panel", arg)
  },
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
  updateUserPassword: (userId: string, newPassword: string) =>
    ipcRenderer.invoke("update-user-password", userId, newPassword),

  // Answer sheet related
  uploadAnswerSheets: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      studentId?: string
      pageNumber?: number
    }[],
  ) => ipcRenderer.invoke("upload-answer-sheets", projectId, filesData),
  getAnswerSheetsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-answer-sheets-by-project-id", projectId),
  deleteAnswerSheet: (answerSheetId: string) =>
    ipcRenderer.invoke("delete-answer-sheet", answerSheetId),
  associateAnswerSheetWithStudent: (answerSheetId: string, studentId: string) =>
    ipcRenderer.invoke(
      "associate-answer-sheet-with-student",
      answerSheetId,
      studentId,
    ),
  setAnswerSheetAbsent: (answerSheetId: string, isAbsent: boolean) =>
    ipcRenderer.invoke("set-answer-sheet-absent", answerSheetId, isAbsent),
  getAnswerSheetById: (answerSheetId: string) =>
    ipcRenderer.invoke("get-answer-sheet-by-id", answerSheetId),
  getImageData: (relativePath: string) =>
    ipcRenderer.invoke("get-image-data", relativePath),

  // Class related
  fetchClasses: () => ipcRenderer.invoke("fetch-classes"),
  createClass: (classData: Prisma.ClassCreateWithoutClassTeachersInput) =>
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
  createStudentClassMembership: (membershipData: Prisma.StudentClassMembershipCreateInput) =>
    ipcRenderer.invoke("create-student-class-membership", membershipData),
  updateStudentClassMembership: (id: string, membershipData: Prisma.StudentClassMembershipUpdateInput) =>
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

  // MasterImage related
  uploadMasterImages: (
    projectId: string,
    filesData: { name: string; type: string; buffer: ArrayBuffer }[], // Updated signature
  ) => ipcRenderer.invoke("upload-master-images", projectId, filesData),
  deleteMasterImage: (imageId: string) =>
    ipcRenderer.invoke("delete-master-image", imageId),
  updateMasterImagesOrder: (
    imageOrders: { id: string; pageNumber: number }[],
  ) => ipcRenderer.invoke("update-master-images-order", imageOrders),

  // New API to resolve file path for display
  resolveFileProtocolPath: (relativePath: string) =>
    ipcRenderer.invoke("resolve-file-protocol-path", relativePath),
  readFileAsBase64: (filePath: string) =>
    ipcRenderer.invoke("read-file-as-base64", filePath),
  getMasterImagesByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-master-images-by-project-id", projectId),
  // Layout region functions (moved to new API)
  createLayoutRegion: (data: LayoutRegionCreateData) =>
    ipcRenderer.invoke("create-layout-region", data),
  updateLayoutRegion: (id: string, data: LayoutRegionUpdateData) =>
    ipcRenderer.invoke("update-layout-region", id, data),
  deleteLayoutRegion: (id: string) =>
    ipcRenderer.invoke("delete-layout-region", id),
  getLayoutRegionsByProjectId: (projectId: string) =>
    ipcRenderer.invoke("get-layout-regions-by-project-id", projectId),

  // Project-Student relationship
  getStudentsForProject: (projectId: string) =>
    ipcRenderer.invoke("get-students-for-project", projectId),
  addStudentsToProject: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke("add-students-to-project", projectId, studentIds),
  removeStudentsFromProject: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke("remove-students-from-project", projectId, studentIds),
  updateStudentProjectStatus: (projectId: string, studentId: string, status: 'participating' | 'expected' | 'absent') =>
    ipcRenderer.invoke("update-student-project-status", projectId, studentId, status),
  checkGradingDataForStudents: (projectId: string, studentIds: string[]) =>
    ipcRenderer.invoke("check-grading-data-for-students", projectId, studentIds),
  getClassesNotInProject: (projectId: string) =>
    ipcRenderer.invoke("get-classes-not-in-project", projectId),
  getStudentsNotInProject: (projectId: string) =>
    ipcRenderer.invoke("get-students-not-in-project", projectId),
  updateStudentOrders: (projectId: string, studentOrders: { studentId: string; customOrder: number }[]) =>
    ipcRenderer.invoke("update-student-orders", projectId, studentOrders),

  // QuestionScore related functions
  getQuestionScoresForProject: (projectId: string) =>
    ipcRenderer.invoke("get-question-scores-for-project", projectId),
  getQuestionScoresForAnswerSheet: (answerSheetId: string) =>
    ipcRenderer.invoke("get-question-scores-for-answer-sheet", answerSheetId),
  createQuestionScore: (data: QuestionScoreCreateData) =>
    ipcRenderer.invoke("create-question-score", data),
  updateQuestionScore: (id: string, data: QuestionScoreUpdateData, expectedVersion: number) =>
    ipcRenderer.invoke("update-question-score", id, data, expectedVersion),
  deleteQuestionScore: (id: string) =>
    ipcRenderer.invoke("delete-question-score", id),
  getQuestionScoreComparison: (answerSheetId: string, layoutRegionId: string) =>
    ipcRenderer.invoke("get-question-score-comparison", answerSheetId, layoutRegionId),
  finalizeQuestionScore: (answerSheetId: string, layoutRegionId: string, scoredByUserId: string, scoreData: QuestionScoreUpdateData) =>
    ipcRenderer.invoke("finalize-question-score", answerSheetId, layoutRegionId, scoredByUserId, scoreData),
  getAnswerSheetProgress: (answerSheetId: string) =>
    ipcRenderer.invoke("get-answer-sheet-progress", answerSheetId),
  getProjectProgress: (projectId: string) =>
    ipcRenderer.invoke("get-project-progress", projectId),
  initializeScoringRecords: (projectId: string) =>
    ipcRenderer.invoke("initialize-scoring-records", projectId),

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

  // Progress listeners
  onExportProgress: (callback: (progress: {
    current: number
    total: number
    step: string
    percentage: number
  }) => void) => {
    ipcRenderer.on('export-progress', (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('export-progress')
  },

  scorePanel: (listener: any) => ipcRenderer.on("score-panel", listener), // 修正: on を使用
  removeScorePanelListener: (listener: any) =>
    ipcRenderer.removeListener("score-panel", listener), // 修正: removeListener を使用
})

process.once("loaded", () => {
  global.ipcRenderer = ipcRenderer
})
