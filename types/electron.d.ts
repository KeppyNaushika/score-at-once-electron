import type {
  Prisma,
  User,
  Class,
  Student,
  Project,
  ProjectPage,
  PageImage,
  CropRegion,
  SubtotalGroup,
  Subtotal,
  CropSubtotal,
  UserProject,
  ProjectSubtotalGroup,
  QuestionScore,
  AnswerSheet,
  ProjectStudent,
  StudentClassMembership,
} from "@prisma/client"

// Answer sheet related types (updated for new structure)
// New: Based on PageImage instead of AnswerSheet
export type AnswerSheetWithDetails = Prisma.PageImageGetPayload<{
  include: {
    student: {
      include: {
        projectStudents: {
          select: {
            customOrder: true
          }
        }
      }
    }
    projectPage: {
      include: {
        project: true
      }
    }
  }
}>

// Legacy AnswerSheet type for backward compatibility
export type LegacyAnswerSheetWithDetails = Prisma.AnswerSheetGetPayload<{
  include: {
    student: true
    project: true
    questionScores: {
      include: {
        cropRegion: true
        scoredByUser: true
        student: true
      }
    }
  }
}>

export interface UploadAnswerSheetFileData {
  name: string
  fileName: string
  originalFileName: string
  type: string
  buffer: ArrayBuffer
  studentId: string
  pageNumber: number
  overwrite: boolean
}

// Prismaの型を拡張してリレーションを含む型を定義
type ClassWithMemberships = Prisma.ClassGetPayload<{
  include: {
    memberships: {
      include: {
        student: true
      }
      where: {
        endDate: null
      }
    }
  }
}>

type StudentWithMemberships = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: {
        class: true
      }
      where: {
        endDate: null
      }
      orderBy: {
        startDate: "desc"
      }
    }
  }
}>

type StudentClassMembershipWithDetails =
  Prisma.StudentClassMembershipGetPayload<{
    include: {
      student: true
      class: true
    }
  }>

// Legacy types for backward compatibility
type ClassWithStudents = ClassWithMemberships
type StudentWithClass = StudentWithMemberships

// Project related types (updated for new structure)
export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    userProjects: { include: { user: true } }
    projectPages: {
      include: {
        pageImages: true
        cropRegions: {
          include: {
            cropSubtotals: { include: { subtotal: true } }
            questionScores: { include: { student: true; scoredByUser: true } }
          }
        }
      }
      orderBy: { pageNumber: "asc" }
    }
    projectSubtotalGroups: {
      include: { subtotalGroup: { include: { subtotals: true } } }
    }
    answerSheets: { include: { student: true; questionScores: true } }
    projectStudents: { include: { student: true } }
  }
}>

// Replaced BackendCreateProjectProps with a more specific type based on Project model
export interface CreateProjectArgs {
  examName: string
  description?: string | null
  examDate?: Date | null
  subject?: string | null
}

export interface UpdateProjectArgs extends Partial<CreateProjectArgs> {
  id: string
}

// CropRegion related types (updated from LayoutRegion)
export type CropRegionWithDetails = Prisma.CropRegionGetPayload<{
  include: {
    projectPage: { include: { project: true } }
    cropSubtotals: {
      include: { subtotal: { include: { subtotalGroup: true } } }
    }
    questionScores: { include: { student: true; scoredByUser: true } }
  }
}>

export type SaveCropRegionArgs = Omit<
  Prisma.CropRegionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
> & { id?: string; projectPageId: string }


// SubtotalGroup and Subtotal related types (updated from QuestionGroup/Item)
export type SubtotalGroupWithItems = Prisma.SubtotalGroupGetPayload<{
  include: {
    subtotals: { orderBy: { order: "asc" } }
    projectSubtotalGroups: { include: { project: true } }
  }
}>
export type SubtotalWithDetails = Prisma.SubtotalGetPayload<{
  include: {
    subtotalGroup: true
    cropSubtotals: { include: { cropRegion: true } }
  }
}>

export type CreateSubtotalGroupArgs = Omit<
  Prisma.SubtotalGroupUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>
export type UpdateSubtotalGroupArgs = Partial<CreateSubtotalGroupArgs> & {
  id: string
}

export type CreateSubtotalArgs = Omit<
  Prisma.SubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "subtotalGroupId"
>
export type UpdateSubtotalArgs = Partial<CreateSubtotalArgs> & { id: string }

// Backward compatibility aliases
export type QuestionGroupWithItems = SubtotalGroupWithItems
export type QuestionGroupItemWithDetails = SubtotalWithDetails
export type CreateQuestionGroupArgs = CreateSubtotalGroupArgs
export type UpdateQuestionGroupArgs = UpdateSubtotalGroupArgs
export type CreateQuestionGroupItemArgs = CreateSubtotalArgs
export type UpdateQuestionGroupItemArgs = UpdateSubtotalArgs

// CropSubtotal related types (unified from SubtotalDefinition + QuestionSubtotalAssignment)
export type CropSubtotalWithRelations = Prisma.CropSubtotalGetPayload<{
  include: {
    cropRegion: { include: { projectPage: true } }
    subtotal: { include: { subtotalGroup: true } }
  }
}>
export type CreateCropSubtotalArgs = Omit<
  Prisma.CropSubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>

// Backward compatibility aliases
export type SubtotalDefinitionWithRelations = CropSubtotalWithRelations
export type CreateSubtotalDefinitionArgs = CreateCropSubtotalArgs
export type QuestionSubtotalAssignmentWithRelations = CropSubtotalWithRelations
export type CreateQuestionSubtotalAssignmentArgs = CreateCropSubtotalArgs

// ProjectPage and PageImage related types (updated from MasterImage)
export type ProjectPageWithDetails = Prisma.ProjectPageGetPayload<{
  include: {
    project: true
    cropRegions: true
    pageImages: { include: { student: true } }
  }
}>

export type PageImageWithDetails = Prisma.PageImageGetPayload<{
  include: {
    projectPage: { include: { project: true } }
    student: true
  }
}>

// Backward compatibility aliases
export type MasterImagePayload = ProjectPageWithDetails

export interface MyAPI {
  fetchProjects: () => Promise<ProjectWithDetails[]>
  fetchProjectById: (projectId: string) => Promise<ProjectWithDetails | null>
  createProject: (
    projectData: CreateProjectArgs,
    userId: string,
  ) => Promise<ProjectWithDetails>
  updateProject: (
    projectId: string,
    data: Prisma.ProjectUpdateInput,
  ) => Promise<ProjectWithDetails>
  deleteProject: (projectId: string) => Promise<Project | void>

  fetchUsers: () => Promise<User[]>
  getCurrentUser: () => Promise<User | null>
  createUser: (userData: {
    username: string
    name: string
    passcode?: string
    passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
  }) => Promise<User>
  updateUser: (
    userId: string,
    userData: { username?: string; name?: string },
  ) => Promise<User>
  verifyPasscode: (userId: string, passcode: string) => Promise<boolean>
  updateUserPasscode: (
    userId: string,
    passcode?: string,
    passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric",
  ) => Promise<User>

  // Authentication related (legacy - may be deprecated)
  loginUser: (
    username: string,
    password: string,
  ) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    token?: string
    error?: string
  }>
  getUserByToken: (token: string) => Promise<{
    success: boolean
    user?: { id: string; username: string; name: string; role: string }
    error?: string
  }>
  updateUserPassword: (
    userId: string,
    newPassword: string,
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Auth token persistence (electron-store)
  saveAuthToken: (
    token: string,
  ) => Promise<{ success: boolean; error?: string }>
  getAuthToken: () => Promise<{
    success: boolean
    token: string | null
    error?: string
  }>
  clearAuthToken: () => Promise<{ success: boolean; error?: string }>
  getAuthStoreStatus: () => Promise<{
    success: boolean
    hasToken: boolean
    storePath: string
    error?: string
  }>

  // Answer sheet related
  uploadAnswerSheets: (
    projectId: string,
    filesData: UploadAnswerSheetFileData[],
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  getAnswerSheetsByProjectId: (projectId: string) => Promise<{
    success: boolean
    answerSheets?: Array<{
      id: string
      studentId: string | null
      pageNumber: number
      originalImagePath: string | null
      isAbsent: boolean
      student: {
        id: string
        lastName: string
        firstName: string
        lastNameKana: string
        firstNameKana: string
        studentId: string
      } | null
      projectId: string
      status: "ready"
    }>
    error?: string
  }>
  deleteAnswerSheet: (answerSheetId: string) => Promise<{
    success: boolean
    error?: string
  }>
  associateAnswerSheetWithStudent: (
    answerSheetId: string,
    studentId: string,
  ) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  setAnswerSheetAbsent: (
    answerSheetId: string,
    isAbsent: boolean,
  ) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  getAnswerSheetById: (answerSheetId: string) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  updateAnswerSheetPlacement: (
    answerSheetId: string,
    studentId: string | null,
    pageNumber: number,
  ) => Promise<{
    success: boolean
    answerSheet?: AnswerSheetWithDetails
    error?: string
  }>
  swapAnswerSheetPlacements: (
    answerSheetId1: string,
    answerSheetId2: string,
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  swapAnswerSheetPlacementsWithScoring: (
    answerSheetId1: string,
    answerSheetId2: string,
  ) => Promise<{
    success: boolean
    answerSheets?: AnswerSheetWithDetails[]
    error?: string
  }>
  batchUpdateAnswerSheetPlacements: (
    moves: Array<{
      fileId: string
      finalStudentId: string | null
      finalPageNumber: number
    }>,
    withScoring: boolean,
  ) => Promise<{
    success: boolean
    error?: string
  }>
  getImageData: (relativePath: string) => Promise<{
    success: boolean
    data?: string
    error?: string
  }>

  // Class related
  fetchClasses: () => Promise<ClassWithStudents[]>
  getClassesNotInProject: (projectId: string) => Promise<{
    success: boolean
    classes?: (ClassWithStudents & { studentCount: number })[]
    error?: string
  }>
  getStudentsNotInProject: (projectId: string) => Promise<{
    success: boolean
    students?: StudentWithMemberships[]
    error?: string
  }>
  createClass: (
    classData: Prisma.ClassCreateWithoutTeachersInput,
  ) => Promise<ClassWithStudents>
  updateClass: (
    classData: Prisma.ClassUpdateInput & { id: string },
  ) => Promise<ClassWithStudents> // Ensure id is part of update
  deleteClass: (classId: string) => Promise<Class | void>

  // Student related
  fetchStudents: () => Promise<StudentWithMemberships[]>
  createStudent: (
    studentData: Prisma.StudentCreateInput,
  ) => Promise<StudentWithMemberships>
  updateStudent: (
    id: string,
    studentData: Prisma.StudentUpdateInput,
  ) => Promise<StudentWithMemberships>
  deleteStudent: (id: string) => Promise<Student | void>
  importStudentsFromFile: (
    filePath: string,
    existingClasses: { id: string; name: string }[],
  ) => Promise<{
    success: boolean
    importedStudents?: StudentWithMemberships[]
    error?: string
  }>

  // Student Class Membership related
  createStudentClassMembership: (
    membershipData: Prisma.StudentClassMembershipCreateInput,
  ) => Promise<StudentClassMembershipWithDetails>
  updateStudentClassMembership: (
    id: string,
    membershipData: Prisma.StudentClassMembershipUpdateInput,
  ) => Promise<StudentClassMembershipWithDetails>
  deleteStudentClassMembership: (id: string) => Promise<void>
  getCurrentMembershipsByStudentId: (
    studentId: string,
  ) => Promise<StudentClassMembershipWithDetails[]>
  getAllMembershipsByStudentId: (
    studentId: string,
  ) => Promise<StudentClassMembershipWithDetails[]>
  getCurrentMembershipsByClassId: (
    classId: string,
  ) => Promise<StudentClassMembershipWithDetails[]>
  addStudentToClass: (
    studentId: string,
    classId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string,
  ) => Promise<StudentClassMembershipWithDetails>
  endStudentMembership: (
    membershipId: string,
    endDate?: Date,
  ) => Promise<StudentClassMembershipWithDetails>
  getMembershipsByDateRange: (
    startDate: Date,
    endDate?: Date,
  ) => Promise<StudentClassMembershipWithDetails[]>

  // ProjectPage and PageImage related (updated from MasterImage)
  createProjectPage: (
    projectId: string,
    pageNumber: number,
  ) => Promise<ProjectPageWithDetails>
  uploadPageImages: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
      pageNumber: number
      imageType: "MASTER" | "ANSWER"
      studentId?: string | null
    }[],
  ) => Promise<PageImageWithDetails[]>
  deletePageImage: (imageId: string) => Promise<PageImage | void>
  updateProjectPagesOrder: (
    pageOrders: { id: string; pageNumber: number }[],
  ) => Promise<Prisma.BatchPayload>
  resolveFileProtocolPath: (relativePath: string) => Promise<string>
  readFileAsBase64: (filePath: string) => Promise<{
    success: boolean
    data?: string
    mimeType?: string
    error?: string
  }>
  checkFileExists: (relativePath: string) => Promise<{
    success: boolean
    exists: boolean
    path: string
    error?: string
  }>
  getProjectPagesByProjectId: (
    projectId: string,
  ) => Promise<ProjectPageWithDetails[]>
  getPageImagesByProjectId: (
    projectId: string,
  ) => Promise<PageImageWithDetails[]>

  // Backward compatibility aliases
  uploadMasterImages: (
    projectId: string,
    filesData: {
      name: string
      type: string
      buffer: ArrayBuffer
      path?: string
    }[],
  ) => Promise<ProjectPageWithDetails[]>
  deleteMasterImage: (imageId: string) => Promise<ProjectPageWithDetails | void>
  updateMasterImagesOrder: (
    imageOrders: { id: string; pageNumber: number }[],
  ) => Promise<Prisma.BatchPayload>
  getMasterImagesByProjectId: (
    projectId: string,
  ) => Promise<ProjectPageWithDetails[]>
  getProjectPagesByProjectId: (
    projectId: string,
  ) => Promise<ProjectPageWithDetails[]>

  // CropRegion related (updated from LayoutRegion)
  createCropRegion: (
    data: Prisma.CropRegionUncheckedCreateInput,
  ) => Promise<CropRegionWithDetails>
  createManyCropRegions: (
    data: Prisma.CropRegionCreateManyInput[],
  ) => Promise<Prisma.BatchPayload>
  updateCropRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput,
  ) => Promise<CropRegionWithDetails>
  deleteCropRegion: (id: string) => Promise<CropRegion | void>
  getCropRegionsByProjectId: (
    projectId: string,
  ) => Promise<CropRegionWithDetails[]>
  getCropRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>,
  ) => Promise<CropRegion[]>

  // Backward compatibility aliases
  createLayoutRegion: (
    data: Prisma.CropRegionUncheckedCreateInput,
  ) => Promise<CropRegionWithDetails>
  createManyLayoutRegions: (
    data: Prisma.CropRegionCreateManyInput[],
  ) => Promise<Prisma.BatchPayload>
  updateLayoutRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput,
  ) => Promise<CropRegionWithDetails>
  deleteLayoutRegion: (id: string) => Promise<CropRegion | void>
  getCropRegionsByProjectId: (
    projectId: string,
  ) => Promise<CropRegionWithDetails[]>
  getCropRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>,
  ) => Promise<CropRegion[]>


  // SubtotalGroup related (updated from QuestionGroup)
  getSubtotalGroups: () => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  createSubtotalGroup: (data: {
    name: string
    subtotals: {
      name: string
      order: number
    }[]
  }) => Promise<{
    success: boolean
    subtotalGroup?: SubtotalGroupWithItems
    error?: string
  }>
  updateSubtotalGroup: (
    id: string,
    data: {
      name: string
      subtotals: {
        name: string
        order: number
      }[]
    },
  ) => Promise<{
    success: boolean
    subtotalGroup?: SubtotalGroupWithItems
    error?: string
  }>
  deleteSubtotalGroup: (id: string) => Promise<{
    success: boolean
    error?: string
  }>
  getSubtotalGroupsByProjectId: (
    projectId: string,
  ) => Promise<SubtotalGroupWithItems[]>
  getSubtotalGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>
  getAvailableSubtotalGroupsForProject: (projectId: string) => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  getActiveSubtotalGroupsForProject: (projectId: string) => Promise<{
    success: boolean
    projectSubtotalGroups?: Prisma.ProjectSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: {
          include: {
            subtotals: true
          }
        }
      }
    }>[]
    error?: string
  }>
  addSubtotalGroupToProject: (
    projectId: string,
    subtotalGroupId: string,
  ) => Promise<{
    success: boolean
    projectSubtotalGroup?: Prisma.ProjectSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: {
          include: {
            subtotals: true
          }
        }
      }
    }>
    error?: string
  }>
  removeSubtotalGroupFromProject: (
    projectId: string,
    subtotalGroupId: string,
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Backward compatibility aliases
  createQuestionGroup: (
    data: Prisma.SubtotalGroupUncheckedCreateInput,
  ) => Promise<SubtotalGroupWithItems>
  updateQuestionGroup: (
    id: string,
    data: Prisma.SubtotalGroupUpdateInput,
  ) => Promise<SubtotalGroupWithItems>
  deleteQuestionGroup: (id: string) => Promise<SubtotalGroup | void>
  getQuestionGroupsByProjectId: (
    projectId: string,
  ) => Promise<SubtotalGroupWithItems[]>
  getQuestionGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>

  // Subtotal related (updated from QuestionGroupItem)
  createSubtotal: (
    data: Prisma.SubtotalUncheckedCreateInput,
  ) => Promise<SubtotalWithDetails>
  createManySubtotals: (
    items: Prisma.SubtotalUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  updateSubtotal: (
    id: string,
    data: Prisma.SubtotalUpdateInput,
  ) => Promise<SubtotalWithDetails>
  deleteSubtotal: (id: string) => Promise<Subtotal | void>
  getSubtotalsByGroupId: (
    subtotalGroupId: string,
  ) => Promise<SubtotalWithDetails[]>
  getSubtotalById: (id: string) => Promise<SubtotalWithDetails | null>
  updateSubtotalOrders: (
    orders: { id: string; order: number }[],
  ) => Promise<Prisma.BatchPayload>

  // Backward compatibility aliases
  createQuestionGroupItem: (
    data: Prisma.SubtotalUncheckedCreateInput,
  ) => Promise<SubtotalWithDetails>
  createManyQuestionGroupItems: (
    items: Prisma.SubtotalUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  updateQuestionGroupItem: (
    id: string,
    data: Prisma.SubtotalUpdateInput,
  ) => Promise<SubtotalWithDetails>
  deleteQuestionGroupItem: (id: string) => Promise<Subtotal | void>
  getQuestionGroupItemsByGroupId: (
    questionGroupId: string,
  ) => Promise<SubtotalWithDetails[]>
  getQuestionGroupItemById: (id: string) => Promise<SubtotalWithDetails | null>
  updateQuestionGroupItemOrders: (
    orders: { id: string; order: number }[],
  ) => Promise<Prisma.BatchPayload>

  // CropSubtotal related (unified from SubtotalDefinition)
  createCropSubtotal: (
    data: Prisma.CropSubtotalUncheckedCreateInput,
  ) => Promise<CropSubtotalWithRelations>
  createManyCropSubtotals: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  deleteCropSubtotal: (id: string) => Promise<CropSubtotal | void>
  deleteCropSubtotalsByCropRegionId: (
    cropRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  getCropSubtotalsByCropRegionId: (
    cropRegionId: string,
  ) => Promise<CropSubtotalWithRelations[]>
  getCropSubtotalsBySubtotalId: (
    subtotalId: string,
  ) => Promise<CropSubtotalWithRelations[]>

  // Backward compatibility aliases
  createSubtotalDefinition: (
    data: Prisma.CropSubtotalUncheckedCreateInput,
  ) => Promise<CropSubtotalWithRelations>
  createManySubtotalDefinitions: (
    definitions: Prisma.CropSubtotalUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  deleteSubtotalDefinition: (id: string) => Promise<CropSubtotal | void>
  deleteSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string,
  ) => Promise<CropSubtotalWithRelations[]>
  
  // Backward compatibility aliases
  deleteSubtotalDefinitionsByLayoutRegionId: (
    cropRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string,
  ) => Promise<CropSubtotalWithRelations[]>
  getSubtotalDefinitionsByQuestionGroupItemId: (
    questionGroupItemId: string,
  ) => Promise<CropSubtotalWithRelations[]>

  // UserProject and ProjectSubtotalGroup related (new many-to-many relations)
  createUserProject: (
    data: Prisma.UserProjectUncheckedCreateInput,
  ) => Promise<
    Prisma.UserProjectGetPayload<{ include: { user: true; project: true } }>
  >
  deleteUserProject: (id: string) => Promise<UserProject | void>
  getUserProjectsByUserId: (
    userId: string,
  ) => Promise<Prisma.UserProjectGetPayload<{ include: { project: true } }>[]>
  getUserProjectsByProjectId: (
    projectId: string,
  ) => Promise<Prisma.UserProjectGetPayload<{ include: { user: true } }>[]>

  createProjectSubtotalGroup: (
    data: Prisma.ProjectSubtotalGroupUncheckedCreateInput,
  ) => Promise<
    Prisma.ProjectSubtotalGroupGetPayload<{
      include: { project: true; subtotalGroup: true }
    }>
  >
  deleteProjectSubtotalGroup: (
    id: string,
  ) => Promise<ProjectSubtotalGroup | void>
  getProjectSubtotalGroupsByProjectId: (projectId: string) => Promise<
    Prisma.ProjectSubtotalGroupGetPayload<{
      include: { subtotalGroup: { include: { subtotals: true } } }
    }>[]
  >

  // Backward compatibility aliases (redirects to CropSubtotal)
  createQuestionSubtotalAssignment: (
    data: Prisma.CropSubtotalUncheckedCreateInput,
  ) => Promise<CropSubtotalWithRelations>
  createManyQuestionSubtotalAssignments: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[],
  ) => Promise<Prisma.BatchPayload>
  deleteQuestionSubtotalAssignment: (id: string) => Promise<CropSubtotal | void>
  deleteAssignmentsByQuestionCropRegionId: (
    questionCropRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  
  // Backward compatibility alias
  deleteAssignmentsByQuestionLayoutRegionId: (
    questionLayoutRegionId: string,
  ) => Promise<Prisma.BatchPayload>
  deleteAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string,
  ) => Promise<Prisma.BatchPayload>
  getAssignmentsByQuestionCropRegionId: (
    questionCropRegionId: string,
  ) => Promise<CropSubtotalWithRelations[]>
  getAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string,
  ) => Promise<CropSubtotalWithRelations[]>

  // Project-Student relationship
  getStudentsForProject: (projectId: string) => Promise<{
    success: boolean
    students?: (StudentWithMemberships & {
      status: "participating" | "expected" | "absent"
      isInProject: boolean
    })[]
    error?: string
  }>
  addStudentsToProject: (
    projectId: string,
    studentIds: string[],
  ) => Promise<{
    success: boolean
    error?: string
  }>
  removeStudentsFromProject: (
    projectId: string,
    studentIds: string[],
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentProjectStatus: (
    projectId: string,
    studentId: string,
    status: "participating" | "expected" | "absent",
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentOrders: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[],
  ) => Promise<{
    success: boolean
    error?: string
  }>
  checkGradingDataForStudents: (
    projectId: string,
    studentIds: string[],
  ) => Promise<{
    success: boolean
    hasAnyData?: boolean
    totalGradingItems?: number
    studentData?: Record<
      string,
      {
        hasData: boolean
        answerSheetCount: number
        questionScoreCount: number
        totalGradingItems: number
      }
    >
    error?: string
  }>

  // QuestionScore関連のAPI
  getQuestionScoresForProject: (projectId: string) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  getQuestionScoresForAnswerSheet: (answerSheetId: string) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  createQuestionScore: (data: {
    cropRegionId: string // Updated: renamed from layoutRegionId
    studentId?: string | null // Updated: now references student directly
    partialScore?: number
    status:
      | "unscored"
      | "correct"
      | "incorrect"
      | "partial"
      | "pending"
      | "no_answer"
      | "proposed"
      | "final"
    scoredByUserId?: string | null
  }) => Promise<QuestionScore>

  // Backward compatibility alias
  createQuestionScoreLegacy: (data: {
    answerSheetId: string
    cropRegionId: string
    partialScore?: number
    status:
      | "unscored"
      | "correct"
      | "incorrect"
      | "partial"
      | "pending"
      | "no_answer"
      | "proposed"
      | "final"
    comment?: string
    scoredByUserId: string
  }) => Promise<QuestionScore>
  updateQuestionScore: (
    id: string,
    data: {
      partialScore?: number
      status?:
        | "unscored"
        | "correct"
        | "incorrect"
        | "partial"
        | "pending"
        | "no_answer"
        | "proposed"
        | "final"
      comment?: string
      version?: number
    },
    expectedVersion?: number,
  ) => Promise<QuestionScore>
  deleteQuestionScore: (id: string) => Promise<QuestionScore | void>
  getQuestionScoreComparison: (
    cropRegionId: string,
    studentId: string,
  ) => Promise<{
    current?: QuestionScore
    competing?: QuestionScore[]
    needsResolution: boolean
  }>
  finalizeQuestionScore: (
    cropRegionId: string,
    studentId: string,
    scoredByUserId: string,
    scoreData: {
      partialScore?: number
      status: string
      comments?: string
    },
  ) => Promise<QuestionScore>

  // Backward compatibility aliases
  getQuestionScoreComparisonLegacy: (
    answerSheetId: string,
    layoutRegionId: string,
  ) => Promise<{
    current?: QuestionScore
    competing?: QuestionScore[]
    needsResolution: boolean
  }>
  finalizeQuestionScoreLegacy: (
    answerSheetId: string,
    layoutRegionId: string,
    scoredByUserId: string,
    scoreData: {
      partialScore?: number
      status: string
      comments?: string
    },
  ) => Promise<QuestionScore>
  getAnswerSheetProgress: (answerSheetId: string) => Promise<{
    totalQuestions: number
    completedQuestions: number
    percentage: number
  }>
  getProjectProgress: (projectId: string) => Promise<{
    totalAnswerSheets: number
    completedAnswerSheets: number
    percentage: number
  }>
  initializeScoringRecords: (projectId: string) => Promise<{
    success: boolean
    initialized?: number
    message?: string
    error?: string
  }>

  // PDF Export related
  exportScoredAnswersPDF: (options: {
    projectId: string
    selectedStudentIds: string[]
    outputPath?: string
    pdfOrientation?: "portrait" | "landscape"
    scoringMarkConfig?: {
      position: string
      size: number
      showTransparent: boolean
    }
  }) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // Excel Export related
  exportGradingDataExcel: (options: {
    projectId: string
    selectedStudentIds: string[]
    outputPath?: string
    forceExport?: boolean
  }) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
    warnings?: {
      noScoringData: string[]
      unscored: string[]
      missingPartialScore: string[]
    }
    validationResult?: {
      hasWarnings: boolean
      warnings: {
        noScoringData: string[]
        unscored: string[]
        missingPartialScore: string[]
      }
    }
  }>

  // データ管理関連
  getDataDirectoryInfo: () => Promise<{
    success: boolean
    directory?: string
    size?: number
    projectCount?: number
    error?: string
  }>
  openDataDirectory: () => Promise<{
    success: boolean
    error?: string
  }>
  deleteAllData: () => Promise<{
    success: boolean
    error?: string
  }>

  // Progress listeners
  onExportProgress: (
    callback: (progress: {
      current: number
      total: number
      step: string
      percentage: number
      currentStepIndex?: number
      totalSteps?: number
    }) => void,
  ) => () => void
}

declare global {
  interface Window {
    electronAPI: MyAPI
  }
}
