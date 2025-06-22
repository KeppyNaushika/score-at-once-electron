import { join } from "path"
import { format } from "url"

import { app, BrowserWindow, ipcMain, Menu, net, protocol } from "electron"
import isDev from "electron-is-dev"
import prepareNext from "electron-next"
import menu from "./menu"

import { Prisma } from "@prisma/client"
import path from "path"
import {
  createClass,
  deleteClass,
  fetchClasses,
  updateClass,
} from "./lib/prisma/class"
import {
  deleteMasterImage,
  uploadMasterImages,
  updateMasterImagesOrder,
} from "./lib/prisma/masterImage"

import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  getProjectById as dbFetchProjectById,
  getProjects as dbFetchProjects,
  updateProject as dbUpdateProject,
} from "./lib/prisma/project"

// New imports for subtotaling and layout regions
import {
  createLayoutRegion as dbCreateLayoutRegion,
  updateLayoutRegion as dbUpdateLayoutRegion,
  deleteLayoutRegion as dbDeleteLayoutRegion,
  getLayoutRegionsByProjectId as dbGetLayoutRegionsByProjectId,
  getLayoutRegionById as dbGetLayoutRegionById,
  createManyLayoutRegions as dbCreateManyLayoutRegions,
} from "./lib/prisma/layoutRegion"
import {
  createQuestionGroup as dbCreateQuestionGroup,
  updateQuestionGroup as dbUpdateQuestionGroup,
  deleteQuestionGroup as dbDeleteQuestionGroup,
  getQuestionGroupsByProjectId as dbGetQuestionGroupsByProjectId,
  getQuestionGroupById as dbGetQuestionGroupById,
} from "./lib/prisma/questionGroup"
import {
  createQuestionGroupItem as dbCreateQuestionGroupItem,
  updateQuestionGroupItem as dbUpdateQuestionGroupItem,
  deleteQuestionGroupItem as dbDeleteQuestionGroupItem,
  getQuestionGroupItemsByGroupId as dbGetQuestionGroupItemsByGroupId,
  getQuestionGroupItemById as dbGetQuestionGroupItemById,
  createManyQuestionGroupItems as dbCreateManyQuestionGroupItems,
} from "./lib/prisma/questionGroupItem"
import {
  createSubtotalDefinition as dbCreateSubtotalDefinition,
  deleteSubtotalDefinition as dbDeleteSubtotalDefinition,
  getSubtotalDefinitionsByLayoutRegionId as dbGetSubtotalDefsByLayoutRegionId,
  getSubtotalDefinitionsByQuestionGroupItemId as dbGetSubtotalDefsByQGItemId,
  createManySubtotalDefinitions as dbCreateManySubtotalDefinitions,
  deleteSubtotalDefinitionsByLayoutRegionId as dbDeleteSubDefsByLayoutRegionId,
} from "./lib/prisma/subtotalDefinition"
import {
  createQuestionSubtotalAssignment as dbCreateQuestionSubtotalAssignment,
  deleteQuestionSubtotalAssignment as dbDeleteQuestionSubtotalAssignment,
  getAssignmentsByQuestionLayoutRegionId as dbGetAssignsByQuestionLayoutRegionId,
  getAssignmentsByQuestionGroupItemId as dbGetAssignsByQGItemId,
  createManyQuestionSubtotalAssignments as dbCreateManyQuestionSubtotalAssignments,
  deleteAssignmentsByQuestionLayoutRegionId as dbDeleteAssignsByQuestionLayoutRegionId,
  deleteAssignmentsByQuestionGroupItemId as dbDeleteAssignsByQGItemId,
} from "./lib/prisma/questionSubtotalAssignment"

import { 
  fetchStudents, 
  importStudentsFromFile, 
  createStudent, 
  updateStudent, 
  deleteStudent 
} from "./lib/prisma/student"
import {
  getStudentsForProject,
  addStudentsToProject,
  removeStudentsFromProject,
  updateStudentProjectStatus,
  getClassesNotInProject,
} from "./lib/prisma/projectStudent"
import {
  checkGradingDataForStudents,
} from "./lib/prisma/gradingData"
import {
  getQuestionScoresForProject,
  getQuestionScoresForAnswerSheet,
  createQuestionScore,
  updateQuestionScore,
  deleteQuestionScore,
  getQuestionScoreComparison,
  finalizeQuestionScore,
  getAnswerSheetProgress,
  getProjectProgress,
  CreateQuestionScoreData,
  UpdateQuestionScoreData,
} from "./lib/prisma/questionScore"
import {
  createStudentClassMembership,
  updateStudentClassMembership,
  deleteStudentClassMembership,
  getCurrentMembershipsByStudentId,
  getAllMembershipsByStudentId,
  getCurrentMembershipsByClassId,
  addStudentToClass,
  endStudentMembership,
  getMembershipsByDateRange,
  getMembershipsBySubject,
} from "./lib/prisma/studentClassMembership"
// import { createTag, deleteTag, updateTag } from "./lib/prisma/tag" // Tagモデルが未実装のため一時的にコメントアウト
import { fetchUsers, getCurrentUser } from "./lib/prisma/user"
import { loginUser, createUser, getUserByToken, updateUserPassword } from "./lib/prisma/auth"
import {
  uploadAnswerSheets,
  getAnswerSheetsByProjectId,
  deleteAnswerSheet,
  associateAnswerSheetWithStudent,
  setAnswerSheetAbsent,
  getAnswerSheetById,
} from "./lib/prisma/answerSheet"

app.on("ready", async () => {
  if (isDev) {
    // 開発環境では electron-next は使わない
  } else {
    await prepareNext("./")
  }

  protocol.handle("appimg", async (request) => {
    try {
      const relativePathInUserData = request.url.substring("appimg://".length)
      const decodedRelativePath = decodeURI(relativePathInUserData)
      const absolutePath = path.join(
        app.getPath("userData"),
        decodedRelativePath,
      )

      const fileURL = format({
        pathname: absolutePath,
        protocol: "file:",
        slashes: true,
      })
      return net.fetch(fileURL)
    } catch (error) {
      console.error(
        `Failed to handle 'appimg' protocol request ${request.url}:`,
        error,
      )

      return new Response("File not found", { status: 404 })
    }
  })

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // 開発環境でのみ使用
    },
  })

  const url = isDev
    ? "http://localhost:3000"
    : format({
        pathname: join(__dirname, "../renderer/out/index.html"),
        protocol: "file:",
        slashes: true,
      })
  Menu.setApplicationMenu(menu(app, mainWindow, "home"))

  ipcMain.on("set-shortcut", (_event, page: string) => {
    Menu.setApplicationMenu(menu(app, mainWindow, page))
  })
  ipcMain.on("score-panel", (_event, arg: string) => {
    mainWindow.webContents.send("score-panel", arg)
  })

  ipcMain.handle("fetch-projects", async () => {
    try {
      return await dbFetchProjects()
    } catch (err) {
      console.error("Error fetching projects:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-project-by-id", async (_event, projectId: string) => {
    try {
      return await dbFetchProjectById(projectId)
    } catch (err) {
      console.error("Error fetching project by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-project",
    async (
      _event,
      projectData: Omit<Prisma.ProjectCreateInput, "user">,
      userId: string,
    ) => {
      try {
        if (!userId) throw new Error("User ID is required to create a project.")
        return await dbCreateProject(projectData, userId)
      } catch (err) {
        console.error("Error creating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-project",
    async (_event, projectId: string, data: Prisma.ProjectUpdateInput) => {
      try {
        // dbUpdateProject now expects 2 arguments based on its definition in project.ts
        return await dbUpdateProject(projectId, data)
      } catch (err) {
        console.error("Error updating project:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-project", async (_event, projectId: string) => {
    try {
      return await dbDeleteProject(projectId)
    } catch (err) {
      console.error("Error deleting project:", err)
      throw err
    }
  })

  // Tag handlers temporarily disabled - Tag model not implemented
  // ipcMain.handle("create-tag", async (_event, tagText: string) => {
  //   try {
  //     return await createTag(tagText)
  //   } catch (err) {
  //     console.error("Error creating tag:", err)
  //     throw err
  //   }
  // })

  // ipcMain.handle(
  //   "update-tag",
  //   async (_event, tagId: string, newText: string) => {
  //     try {
  //       return await updateTag(tagId, newText)
  //     } catch (err) {
  //       console.error("Error updating tag:", err)
  //       throw err
  //     }
  //   },
  // )

  // ipcMain.handle("delete-tag", async (_event, tagId: string) => {
  //   try {
  //     return await deleteTag(tagId)
  //   } catch (err) {
  //     console.error("Error deleting tag:", err)
  //     throw err
  //   }
  // })

  ipcMain.handle("fetch-users", async () => {
    try {
      return await fetchUsers()
    } catch (err) {
      console.error("Error fetching users:", err)
      throw err
    }
  })
  ipcMain.handle("get-current-user", async () => {
    try {
      return await getCurrentUser()
    } catch (err) {
      console.error("Error getting current user:", err)
      throw err
    }
  })

  // Authentication handlers
  ipcMain.handle("login-user", async (_event, username: string, password: string) => {
    try {
      return await loginUser(username, password)
    } catch (err) {
      console.error("Error logging in user:", err)
      throw err
    }
  })

  ipcMain.handle("create-user", async (_event, userData: {
    username: string
    password: string
    name: string
    role?: string
  }) => {
    try {
      return await createUser(userData)
    } catch (err) {
      console.error("Error creating user:", err)
      throw err
    }
  })

  ipcMain.handle("get-user-by-token", async (_event, token: string) => {
    try {
      return await getUserByToken(token)
    } catch (err) {
      console.error("Error getting user by token:", err)
      throw err
    }
  })

  ipcMain.handle("update-user-password", async (_event, userId: string, newPassword: string) => {
    try {
      return await updateUserPassword(userId, newPassword)
    } catch (err) {
      console.error("Error updating user password:", err)
      throw err
    }
  })

  // Answer sheet handlers
  ipcMain.handle(
    "upload-answer-sheets",
    async (
      _event,
      projectId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        studentId?: string
        pageNumber?: number
      }[]
    ) => {
      try {
        return await uploadAnswerSheets(projectId, filesData)
      } catch (err) {
        console.error("Error uploading answer sheets:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-answer-sheets-by-project-id",
    async (_event, projectId: string) => {
      try {
        return await getAnswerSheetsByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching answer sheets:", err)
        throw err
      }
    }
  )

  ipcMain.handle("delete-answer-sheet", async (_event, answerSheetId: string) => {
    try {
      return await deleteAnswerSheet(answerSheetId)
    } catch (err) {
      console.error("Error deleting answer sheet:", err)
      throw err
    }
  })

  ipcMain.handle(
    "associate-answer-sheet-with-student",
    async (_event, answerSheetId: string, studentId: string) => {
      try {
        return await associateAnswerSheetWithStudent(answerSheetId, studentId)
      } catch (err) {
        console.error("Error associating answer sheet with student:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "set-answer-sheet-absent",
    async (_event, answerSheetId: string, isAbsent: boolean) => {
      try {
        return await setAnswerSheetAbsent(answerSheetId, isAbsent)
      } catch (err) {
        console.error("Error setting answer sheet absent status:", err)
        throw err
      }
    }
  )

  ipcMain.handle("get-answer-sheet-by-id", async (_event, answerSheetId: string) => {
    try {
      return await getAnswerSheetById(answerSheetId)
    } catch (err) {
      console.error("Error fetching answer sheet by ID:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-classes", async () => {
    try {
      return await fetchClasses()
    } catch (err) {
      console.error("Error fetching classes:", err)
      throw err
    }
  })
  ipcMain.handle(
    "create-class",
    async (_event, classData: Prisma.ClassCreateWithoutTeachersInput) => {
      try {
        return await createClass(classData)
      } catch (err) {
        console.error("Error creating class:", err)
        throw err
      }
    },
  )
  ipcMain.handle(
    "update-class",
    async (_event, classData: Prisma.ClassUpdateInput & { id: string }) => {
      try {
        return await updateClass(classData)
      } catch (err) {
        console.error("Error updating class:", err)
        throw err
      }
    },
  )
  ipcMain.handle("delete-class", async (_event, classId: string) => {
    try {
      return await deleteClass(classId)
    } catch (err) {
      console.error("Error deleting class:", err)
      throw err
    }
  })

  ipcMain.handle("fetch-students", async () => {
    try {
      return await fetchStudents()
    } catch (err) {
      console.error("Error fetching students:", err)
      throw err
    }
  })
  ipcMain.handle(
    "import-students-from-file",
    async (
      _event,
      filePath: string,
      existingClasses: { id: string; name: string }[],
    ) => {
      try {
        return await importStudentsFromFile(filePath, existingClasses)
      } catch (err) {
        console.error("Error importing students from file:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-student",
    async (_event, studentData: Prisma.StudentCreateInput) => {
      try {
        return await createStudent(studentData)
      } catch (err) {
        console.error("Error creating student:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-student",
    async (_event, id: string, studentData: Prisma.StudentUpdateInput) => {
      try {
        return await updateStudent(id, studentData)
      } catch (err) {
        console.error("Error updating student:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-student", async (_event, id: string) => {
    try {
      return await deleteStudent(id)
    } catch (err) {
      console.error("Error deleting student:", err)
      throw err
    }
  })

  // Student Class Membership handlers
  ipcMain.handle(
    "create-student-class-membership",
    async (_event, membershipData: Prisma.StudentClassMembershipCreateInput) => {
      try {
        return await createStudentClassMembership(membershipData)
      } catch (err) {
        console.error("Error creating student class membership:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-student-class-membership",
    async (_event, id: string, membershipData: Prisma.StudentClassMembershipUpdateInput) => {
      try {
        return await updateStudentClassMembership(id, membershipData)
      } catch (err) {
        console.error("Error updating student class membership:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-student-class-membership", async (_event, id: string) => {
    try {
      return await deleteStudentClassMembership(id)
    } catch (err) {
      console.error("Error deleting student class membership:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-current-memberships-by-student-id",
    async (_event, studentId: string) => {
      try {
        return await getCurrentMembershipsByStudentId(studentId)
      } catch (err) {
        console.error("Error getting current memberships by student ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-all-memberships-by-student-id",
    async (_event, studentId: string) => {
      try {
        return await getAllMembershipsByStudentId(studentId)
      } catch (err) {
        console.error("Error getting all memberships by student ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-current-memberships-by-class-id",
    async (_event, classId: string) => {
      try {
        return await getCurrentMembershipsByClassId(classId)
      } catch (err) {
        console.error("Error getting current memberships by class ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "add-student-to-class",
    async (
      _event,
      studentId: string,
      classId: string,
      startDate?: Date,
      subject?: string,
      notes?: string,
    ) => {
      try {
        return await addStudentToClass(
          studentId,
          classId,
          startDate,
          subject,
          notes,
        )
      } catch (err) {
        console.error("Error adding student to class:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "end-student-membership",
    async (_event, membershipId: string, endDate?: Date) => {
      try {
        return await endStudentMembership(membershipId, endDate)
      } catch (err) {
        console.error("Error ending student membership:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-memberships-by-date-range",
    async (_event, startDate: Date, endDate?: Date) => {
      try {
        return await getMembershipsByDateRange(startDate, endDate)
      } catch (err) {
        console.error("Error getting memberships by date range:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-memberships-by-subject",
    async (_event, subject: string) => {
      try {
        return await getMembershipsBySubject(subject)
      } catch (err) {
        console.error("Error getting memberships by subject:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "upload-master-images",
    async (
      _event,
      projectId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        path?: string
      }[],
    ) => {
      try {
        return await uploadMasterImages(projectId, filesData)
      } catch (err) {
        console.error("Error in IPC upload-master-images:", err)
        throw err
      }
    },
  )
  ipcMain.handle("delete-master-image", async (_event, imageId: string) => {
    try {
      return await deleteMasterImage(imageId)
    } catch (err) {
      console.error("Error in IPC delete-master-image:", err)
      throw err
    }
  })
  ipcMain.handle(
    "update-master-images-order",
    async (_event, imageOrders: { id: string; pageNumber: number }[]) => {
      try {
        return await updateMasterImagesOrder(imageOrders)
      } catch (err) {
        console.error("Error in IPC update-master-images-order:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "resolve-file-protocol-path",
    async (_event, relativePath: string) => {
      try {
        return `appimg://${relativePath}`
      } catch (err) {
        console.error("Error in IPC resolve-file-protocol-path:", err)
        throw err
      }
    },
  )

  // REMOVE OBSOLETE ProjectLayout HANDLERS
  // ipcMain.handle("save-project-layout", ...)
  // ipcMain.handle("fetch-project-layout-by-id", ...)
  // ipcMain.handle("fetch-project-layout-by-project-id", ...)
  // ipcMain.handle("delete-project-layout", ...)
  // ipcMain.handle("duplicate-project-layout", ...)

  // --- LayoutRegion Handlers ---
  ipcMain.handle(
    "create-layout-region",
    async (_event, data: Prisma.LayoutRegionUncheckedCreateInput) => {
      try {
        return await dbCreateLayoutRegion(data)
      } catch (err) {
        console.error("Error creating layout region:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-layout-region",
    async (_event, id: string, data: Prisma.LayoutRegionUpdateInput) => {
      try {
        return await dbUpdateLayoutRegion(id, data)
      } catch (err) {
        console.error("Error updating layout region:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-layout-region", async (_event, id: string) => {
    try {
      return await dbDeleteLayoutRegion(id)
    } catch (err) {
      console.error("Error deleting layout region:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-layout-regions-by-project-id",
    async (_event, projectId: string) => {
      try {
        return await dbGetLayoutRegionsByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching layout regions by project ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-layout-region-by-id", async (_event, id: string) => {
    try {
      return await dbGetLayoutRegionById(id)
    } catch (err) {
      console.error("Error fetching layout region by ID:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-many-layout-regions",
    async (_event, data: Prisma.LayoutRegionCreateManyInput[]) => {
      try {
        return await dbCreateManyLayoutRegions(data)
      } catch (err) {
        console.error("Error creating many layout regions:", err)
        throw err
      }
    },
  )

  // --- QuestionGroup Handlers ---
  ipcMain.handle(
    "create-question-group",
    async (_event, data: Prisma.QuestionGroupUncheckedCreateInput) => {
      try {
        return await dbCreateQuestionGroup(data)
      } catch (err) {
        console.error("Error creating question group:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-group",
    async (_event, id: string, data: Prisma.QuestionGroupUpdateInput) => {
      try {
        return await dbUpdateQuestionGroup(id, data)
      } catch (err) {
        console.error("Error updating question group:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-question-group", async (_event, id: string) => {
    try {
      return await dbDeleteQuestionGroup(id)
    } catch (err) {
      console.error("Error deleting question group:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-question-groups-by-project-id",
    async (_event, projectId: string) => {
      try {
        return await dbGetQuestionGroupsByProjectId(projectId)
      } catch (err) {
        console.error("Error fetching question groups by project ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-question-group-by-id", async (_event, id: string) => {
    try {
      return await dbGetQuestionGroupById(id)
    } catch (err) {
      console.error("Error fetching question group by ID:", err)
      throw err
    }
  })

  // --- QuestionGroupItem Handlers ---
  ipcMain.handle(
    "create-question-group-item",
    async (_event, data: Prisma.QuestionGroupItemUncheckedCreateInput) => {
      try {
        return await dbCreateQuestionGroupItem(data)
      } catch (err) {
        console.error("Error creating question group item:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-group-item",
    async (_event, id: string, data: Prisma.QuestionGroupItemUpdateInput) => {
      try {
        return await dbUpdateQuestionGroupItem(id, data)
      } catch (err) {
        console.error("Error updating question group item:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-question-group-item", async (_event, id: string) => {
    try {
      return await dbDeleteQuestionGroupItem(id)
    } catch (err) {
      console.error("Error deleting question group item:", err)
      throw err
    }
  })

  ipcMain.handle(
    "get-question-group-items-by-group-id",
    async (_event, questionGroupId: string) => {
      try {
        return await dbGetQuestionGroupItemsByGroupId(questionGroupId)
      } catch (err) {
        console.error("Error fetching question group items by group ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-group-item-by-id",
    async (_event, id: string) => {
      try {
        return await dbGetQuestionGroupItemById(id)
      } catch (err) {
        console.error("Error fetching question group item by ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-many-question-group-items",
    async (_event, items: Prisma.QuestionGroupItemUncheckedCreateInput[]) => {
      try {
        return await dbCreateManyQuestionGroupItems(items)
      } catch (err) {
        console.error("Error creating many question group items:", err)
        throw err
      }
    },
  )

  // --- SubtotalDefinition Handlers ---
  ipcMain.handle(
    "create-subtotal-definition",
    async (_event, data: Prisma.SubtotalDefinitionUncheckedCreateInput) => {
      try {
        return await dbCreateSubtotalDefinition(data)
      } catch (err) {
        console.error("Error creating subtotal definition:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-many-subtotal-definitions",
    async (
      _event,
      definitions: Prisma.SubtotalDefinitionUncheckedCreateInput[],
    ) => {
      try {
        return await dbCreateManySubtotalDefinitions(definitions)
      } catch (err) {
        console.error("Error creating many subtotal definitions:", err)
        throw err
      }
    },
  )

  ipcMain.handle("delete-subtotal-definition", async (_event, id: string) => {
    try {
      return await dbDeleteSubtotalDefinition(id)
    } catch (err) {
      console.error("Error deleting subtotal definition:", err)
      throw err
    }
  })

  ipcMain.handle(
    "delete-subtotal-definitions-by-layout-region-id",
    async (_event, layoutRegionId: string) => {
      try {
        return await dbDeleteSubDefsByLayoutRegionId(layoutRegionId)
      } catch (err) {
        console.error(
          "Error deleting subtotal definitions by layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-subtotal-definitions-by-layout-region-id",
    async (_event, layoutRegionId: string) => {
      try {
        return await dbGetSubtotalDefsByLayoutRegionId(layoutRegionId)
      } catch (err) {
        console.error(
          "Error fetching subtotal definitions by layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-subtotal-definitions-by-question-group-item-id",
    async (_event, questionGroupItemId: string) => {
      try {
        return await dbGetSubtotalDefsByQGItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error fetching subtotal definitions by question group item ID:",
          err,
        )
        throw err
      }
    },
  )

  // --- QuestionSubtotalAssignment Handlers ---
  ipcMain.handle(
    "create-question-subtotal-assignment",
    async (
      _event,
      data: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput,
    ) => {
      try {
        return await dbCreateQuestionSubtotalAssignment(data)
      } catch (err) {
        console.error("Error creating question subtotal assignment:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-many-question-subtotal-assignments",
    async (
      _event,
      assignments: Prisma.QuestionSubtotalAssignmentUncheckedCreateInput[],
    ) => {
      try {
        return await dbCreateManyQuestionSubtotalAssignments(assignments)
      } catch (err) {
        console.error("Error creating many question subtotal assignments:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-question-subtotal-assignment",
    async (_event, id: string) => {
      try {
        return await dbDeleteQuestionSubtotalAssignment(id)
      } catch (err) {
        console.error("Error deleting question subtotal assignment:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-assignments-by-question-layout-region-id",
    async (_event, questionLayoutRegionId: string) => {
      try {
        return await dbDeleteAssignsByQuestionLayoutRegionId(
          questionLayoutRegionId,
        )
      } catch (err) {
        console.error(
          "Error deleting assignments by question layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-assignments-by-question-group-item-id",
    async (_event, questionGroupItemId: string) => {
      try {
        return await dbDeleteAssignsByQGItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error deleting assignments by question group item ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-assignments-by-question-layout-region-id",
    async (_event, questionLayoutRegionId: string) => {
      try {
        return await dbGetAssignsByQuestionLayoutRegionId(
          questionLayoutRegionId,
        )
      } catch (err) {
        console.error(
          "Error fetching assignments by question layout region ID:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-assignments-by-question-group-item-id",
    async (_event, questionGroupItemId: string) => {
      try {
        return await dbGetAssignsByQGItemId(questionGroupItemId)
      } catch (err) {
        console.error(
          "Error fetching assignments by question group item ID:",
          err,
        )
        throw err
      }
    },
  )

  // Project-Student relationship handlers
  ipcMain.handle(
    "get-students-for-project",
    async (_event, projectId: string) => {
      try {
        return await getStudentsForProject(projectId)
      } catch (err) {
        console.error("Error getting students for project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "add-students-to-project",
    async (_event, projectId: string, studentIds: string[]) => {
      try {
        return await addStudentsToProject(projectId, studentIds)
      } catch (err) {
        console.error("Error adding students to project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "remove-students-from-project",
    async (_event, projectId: string, studentIds: string[]) => {
      try {
        return await removeStudentsFromProject(projectId, studentIds)
      } catch (err) {
        console.error("Error removing students from project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-student-project-status",
    async (_event, projectId: string, studentId: string, status: 'participating' | 'expected' | 'absent') => {
      try {
        return await updateStudentProjectStatus(projectId, studentId, status)
      } catch (err) {
        console.error("Error updating student project status:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-classes-not-in-project",
    async (_event, projectId: string) => {
      try {
        return await getClassesNotInProject(projectId)
      } catch (err) {
        console.error("Error getting classes not in project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "check-grading-data-for-students",
    async (_event, projectId: string, studentIds: string[]) => {
      try {
        const result = await checkGradingDataForStudents(projectId, studentIds)
        return { success: true, ...result }
      } catch (err) {
        console.error("Error checking grading data for students:", err)
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
  )

  // QuestionScore 関連のハンドラー
  ipcMain.handle(
    "get-question-scores-for-project",
    async (_event, projectId: string) => {
      try {
        return await getQuestionScoresForProject(projectId)
      } catch (err) {
        console.error("Error getting question scores for project:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-scores-for-answer-sheet",
    async (_event, answerSheetId: string) => {
      try {
        return await getQuestionScoresForAnswerSheet(answerSheetId)
      } catch (err) {
        console.error("Error getting question scores for answer sheet:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-question-score",
    async (_event, data: CreateQuestionScoreData) => {
      try {
        return await createQuestionScore(data)
      } catch (err) {
        console.error("Error creating question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-question-score",
    async (_event, id: string, data: UpdateQuestionScoreData, expectedVersion?: number) => {
      try {
        return await updateQuestionScore(id, data, expectedVersion)
      } catch (err) {
        console.error("Error updating question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "delete-question-score",
    async (_event, id: string) => {
      try {
        return await deleteQuestionScore(id)
      } catch (err) {
        console.error("Error deleting question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-question-score-comparison",
    async (_event, answerSheetId: string, layoutRegionId: string) => {
      try {
        return await getQuestionScoreComparison(answerSheetId, layoutRegionId)
      } catch (err) {
        console.error("Error getting question score comparison:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "finalize-question-score",
    async (_event, answerSheetId: string, layoutRegionId: string, scoredByUserId: string, scoreData: {
      score: number
      maxScore: number
      comment?: string
    }) => {
      try {
        return await finalizeQuestionScore(answerSheetId, layoutRegionId, scoredByUserId, scoreData)
      } catch (err) {
        console.error("Error finalizing question score:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-answer-sheet-progress",
    async (_event, answerSheetId: string) => {
      try {
        return await getAnswerSheetProgress(answerSheetId)
      } catch (err) {
        console.error("Error getting answer sheet progress:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-project-progress",
    async (_event, projectId: string) => {
      try {
        return await getProjectProgress(projectId)
      } catch (err) {
        console.error("Error getting project progress:", err)
        throw err
      }
    },
  )

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
  mainWindow.loadURL(url)
})

app.on("window-all-closed", app.quit)
