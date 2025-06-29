import { ipcMain } from "electron"
import { Prisma } from "@prisma/client"
import {
  createClass,
  deleteClass,
  fetchClasses,
  updateClass,
} from "../lib/prisma/class"
import {
  deleteMasterImage,
  uploadMasterImages,
  updateMasterImagesOrder,
  getMasterImagesByProjectId,
} from "../lib/prisma/masterImage"
import {
  uploadAnswerSheets,
  getAnswerSheetsByProjectId,
  deleteAnswerSheet,
  associateAnswerSheetWithStudent,
  setAnswerSheetAbsent,
  getAnswerSheetById,
} from "../lib/prisma/answerSheet"
import { fetchUsers, getCurrentUser } from "../lib/prisma/user"
import { loginUser, createUser, getUserByToken, updateUserPassword } from "../lib/prisma/auth"

export function setupMiscHandlers(): void {
  // User handlers
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

  // Class handlers
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

  // Master image handlers
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
  
  ipcMain.handle(
    "get-master-images-by-project-id",
    async (_event, projectId: string) => {
      try {
        return await getMasterImagesByProjectId(projectId)
      } catch (err) {
        console.error("Error getting master images by project ID:", err)
        throw err
      }
    },
  )

  // Data management handlers
  ipcMain.handle(
    "get-data-directory-info",
    async (_event) => {
      try {
        const { 
          getDataDirectory, 
          calculateDataSize 
        } = await import("../lib/dataManager")
        const { getProjects: dbFetchProjects } = await import("../lib/prisma/project")
        
        const dataDirectory = getDataDirectory()
        const size = await calculateDataSize()
        
        // プロジェクト数を取得
        const projects = await dbFetchProjects()
        const projectCount = Array.isArray(projects) ? projects.length : 0
        
        return {
          success: true,
          directory: dataDirectory,
          size,
          projectCount
        }
      } catch (err) {
        console.error("Error getting data directory info:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      }
    },
  )

  ipcMain.handle(
    "open-data-directory",
    async (_event) => {
      try {
        const { shell } = await import("electron")
        const { getDataDirectory } = await import("../lib/dataManager")
        
        const dataDirectory = getDataDirectory()
        await shell.openPath(dataDirectory)
        
        return { success: true }
      } catch (err) {
        console.error("Error opening data directory:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      }
    },
  )

  ipcMain.handle(
    "delete-all-data",
    async (_event) => {
      try {
        const { getDataDirectory } = await import("../lib/dataManager")
        const fs = await import("fs/promises")
        
        const dataDirectory = getDataDirectory()
        
        // データフォルダを完全削除
        await fs.rm(dataDirectory, { recursive: true, force: true })
        
        // データディレクトリを再作成
        await fs.mkdir(dataDirectory, { recursive: true })
        
        return { success: true }
      } catch (err) {
        console.error("Error deleting all data:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      }
    },
  )
}