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
  updateAnswerSheetPlacement,
  swapAnswerSheetPlacements,
  swapAnswerSheetPlacementsWithScoring,
  batchUpdateAnswerSheetPlacements,
} from "../lib/prisma/answerSheet"
import { fetchUsers, getCurrentUser } from "../lib/prisma/user"
import {
  loginUser,
  createUser,
  getUserByToken,
  updateUserPassword,
} from "../lib/prisma/auth"
import { getAbsolutePathFromData } from "../lib/dataManager"
import * as fs from "fs/promises"

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
  ipcMain.handle(
    "login-user",
    async (_event, username: string, password: string) => {
      try {
        return await loginUser(username, password)
      } catch (err) {
        console.error("Error logging in user:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "create-user",
    async (
      _event,
      userData: {
        username: string
        name: string
        passcode?: string
        passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
        password?: string  // Legacy support
        role?: string
      },
    ) => {
      try {
        if (userData.passcode !== undefined || userData.passcodeType !== undefined) {
          // New passcode-based user creation
          const { createUser: createUserWithPasscode } = await import("../lib/prisma/user")
          return await createUserWithPasscode({
            username: userData.username,
            name: userData.name,
            passcode: userData.passcode,
            passcodeType: userData.passcodeType
          })
        } else if (userData.password) {
          // Legacy password-based user creation
          return await createUser({
            username: userData.username,
            password: userData.password,
            name: userData.name,
            role: userData.role
          })
        } else {
          throw new Error("Either passcode or password must be provided")
        }
      } catch (err) {
        console.error("Error creating user:", err)
        throw err
      }
    },
  )

  ipcMain.handle("get-user-by-token", async (_event, token: string) => {
    try {
      return await getUserByToken(token)
    } catch (err) {
      console.error("Error getting user by token:", err)
      throw err
    }
  })

  ipcMain.handle(
    "update-user-password",
    async (_event, userId: string, newPassword: string) => {
      try {
        return await updateUserPassword(userId, newPassword)
      } catch (err) {
        console.error("Error updating user password:", err)
        throw err
      }
    },
  )

  ipcMain.handle("verify-passcode", async (_event, userId: string, passcode: string) => {
    try {
      const { verifyPasscode } = await import("../lib/prisma/user")
      return await verifyPasscode(userId, passcode)
    } catch (err) {
      console.error("Error verifying passcode:", err)
      throw err
    }
  })

  ipcMain.handle(
    "update-user",
    async (_event, userId: string, userData: { username?: string; name?: string }) => {
      try {
        const { updateUser } = await import("../lib/prisma/user")
        return await updateUser(userId, userData)
      } catch (err) {
        console.error("Error updating user:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-user-passcode",
    async (_event, userId: string, passcode?: string, passcodeType?: string) => {
      try {
        const { updateUserPasscode } = await import("../lib/prisma/user")
        return await updateUserPasscode(userId, passcode, passcodeType as "none" | "4digit" | "6digit" | "alphanumeric")
      } catch (err) {
        console.error("Error updating user passcode:", err)
        throw err
      }
    },
  )

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
      }[],
    ) => {
      try {
        return await uploadAnswerSheets(projectId, filesData)
      } catch (err) {
        console.error("Error uploading answer sheets:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "get-answer-sheets-by-project-id",
    async (_event, projectId: string) => {
      try {
        const result = await getAnswerSheetsByProjectId(projectId)
        if (!result.success) {
          return { success: false, error: result.error }
        }
        const serializedAnswerSheets = (result.answerSheets || []).map(
          (sheet) => ({
            ...sheet,
            questionScores:
              sheet.questionScores?.map((score) => ({
                ...score,
                partialScore: score.partialScore
                  ? score.partialScore.toString()
                  : null,
              })) || [],
          }),
        )
        return { success: true, answerSheets: serializedAnswerSheets }
      } catch (err) {
        console.error("Error fetching answer sheets:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    },
  )

  ipcMain.handle(
    "delete-answer-sheet",
    async (_event, answerSheetId: string) => {
      try {
        return await deleteAnswerSheet(answerSheetId)
      } catch (err) {
        console.error("Error deleting answer sheet:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "associate-answer-sheet-with-student",
    async (_event, answerSheetId: string, studentId: string) => {
      try {
        return await associateAnswerSheetWithStudent(answerSheetId, studentId)
      } catch (err) {
        console.error("Error associating answer sheet with student:", err)
        throw err
      }
    },
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
    },
  )

  ipcMain.handle(
    "get-answer-sheet-by-id",
    async (_event, answerSheetId: string) => {
      try {
        const result = await getAnswerSheetById(answerSheetId)
        if (!result.success) {
          throw new Error(result.error)
        }
        if (!result.answerSheet) return null
        return {
          ...result.answerSheet,
          questionScores:
            result.answerSheet.questionScores?.map((score) => ({
              ...score,
              partialScore: score.partialScore
                ? score.partialScore.toString()
                : null,
            })) || [],
        }
      } catch (err) {
        console.error("Error fetching answer sheet by ID:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "update-answer-sheet-placement",
    async (
      _event,
      answerSheetId: string,
      studentId: string | null,
      pageNumber: number,
    ) => {
      try {
        const result = await updateAnswerSheetPlacement(
          answerSheetId,
          studentId,
          pageNumber,
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        return {
          ...result.answerSheet,
          questionScores:
            result.answerSheet?.questionScores?.map((score) => ({
              ...score,
              partialScore: score.partialScore
                ? score.partialScore.toString()
                : null,
            })) || [],
        }
      } catch (err) {
        console.error("Error updating answer sheet placement:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "swap-answer-sheet-placements",
    async (_event, answerSheetId1: string, answerSheetId2: string) => {
      try {
        const result = await swapAnswerSheetPlacements(
          answerSheetId1,
          answerSheetId2,
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        return (result.answerSheets || [])
          .filter((sheet) => sheet !== null)
          .map((sheet) => ({
            ...sheet,
            questionScores:
              sheet.questionScores?.map((score) => ({
                ...score,
                partialScore: score.partialScore
                  ? score.partialScore.toString()
                  : null,
              })) || [],
          }))
      } catch (err) {
        console.error("Error swapping answer sheet placements:", err)
        throw err
      }
    },
  )

  ipcMain.handle(
    "swap-answer-sheet-placements-with-scoring",
    async (_event, answerSheetId1: string, answerSheetId2: string) => {
      try {
        const result = await swapAnswerSheetPlacementsWithScoring(
          answerSheetId1,
          answerSheetId2,
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        return (result.answerSheets || [])
          .filter((sheet) => sheet !== null)
          .map((sheet) => ({
            ...sheet,
            questionScores:
              sheet.questionScores?.map((score) => ({
                ...score,
                partialScore: score.partialScore
                  ? score.partialScore.toString()
                  : null,
              })) || [],
          }))
      } catch (err) {
        console.error(
          "Error swapping answer sheet placements with scoring:",
          err,
        )
        throw err
      }
    },
  )

  ipcMain.handle(
    "batch-update-answer-sheet-placements",
    async (
      _event,
      moves: Array<{
        fileId: string
        finalStudentId: string | null
        finalPageNumber: number
      }>,
      withScoring: boolean = false
    ) => {
      try {
        const result = await batchUpdateAnswerSheetPlacements(moves, withScoring)
        if (!result.success) {
          const errorMessage = "error" in result ? result.error : "Unknown error"
          throw new Error(errorMessage)
        }
        return result
      } catch (err) {
        console.error("Error in batch update answer sheet placements:", err)
        throw err
      }
    },
  )

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
    async (_event, classData: Prisma.ClassCreateWithoutClassTeachersInput) => {
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
        // パスを適切にエンコード
        const encodedPath = encodeURI(relativePath)
        const result = `appimg://${encodedPath}`
        
        return result
      } catch (err) {
        console.error("Error in IPC resolve-file-protocol-path:", err)
        throw err
      }
    },
  )

  ipcMain.handle("read-file-as-base64", async (_event, filePath: string) => {
    try {
      const fs = await import("fs/promises")
      const path = await import("path")
      const { getDataDirectory } = await import("../lib/dataManager")

      // 相対パスの場合はdataディレクトリからの相対パスとして解決
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(getDataDirectory(), filePath)

      // ファイルの存在確認
      try {
        await fs.access(resolvedPath)
      } catch {
        return {
          success: false,
          error: "File not found",
        }
      }

      // ファイルを読み込んでBase64に変換
      const buffer = await fs.readFile(resolvedPath)
      const base64Data = buffer.toString("base64")

      // MIMEタイプを推定
      const ext = path.extname(resolvedPath).toLowerCase()
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".gif"
              ? "image/gif"
              : ext === ".webp"
                ? "image/webp"
                : "application/octet-stream"

      return {
        success: true,
        data: `data:${mimeType};base64,${base64Data}`,
        mimeType,
      }
    } catch (err) {
      console.error("Error reading file as base64:", err)
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  ipcMain.handle(
    "get-master-images-by-project-id",
    async (_event, projectId: string) => {
      try {
        const masterImages = await getMasterImagesByProjectId(projectId)
        return masterImages.map((image) => ({
          ...image,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        }))
      } catch (err) {
        console.error("Error getting master images by project ID:", err)
        throw err
      }
    },
  )

  // Data management handlers
  ipcMain.handle("get-data-directory-info", async (_event) => {
    try {
      const { getDataDirectory, calculateDataSize } = await import(
        "../lib/dataManager"
      )
      const { getProjects: dbFetchProjects } = await import(
        "../lib/prisma/project"
      )

      const dataDirectory = getDataDirectory()
      const size = await calculateDataSize()

      // プロジェクト数を取得
      const projects = await dbFetchProjects()
      const projectCount = Array.isArray(projects) ? projects.length : 0

      return {
        success: true,
        directory: dataDirectory,
        size,
        projectCount,
      }
    } catch (err) {
      console.error("Error getting data directory info:", err)
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  ipcMain.handle("open-data-directory", async (_event) => {
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
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  ipcMain.handle("delete-all-data", async (_event) => {
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
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  // 画像ファイル読み込みハンドラー
  ipcMain.handle("get-image-data", async (_event, relativePath: string) => {
    try {
      const absolutePath = getAbsolutePathFromData(relativePath)
      const imageBuffer = await fs.readFile(absolutePath)
      const base64 = imageBuffer.toString("base64")

      // MIMEタイプを推定
      const ext = relativePath.split(".").pop()?.toLowerCase()
      let mimeType = "image/png" // デフォルト
      if (ext === "jpg" || ext === "jpeg") {
        mimeType = "image/jpeg"
      } else if (ext === "gif") {
        mimeType = "image/gif"
      } else if (ext === "webp") {
        mimeType = "image/webp"
      }

      return {
        success: true,
        data: `data:${mimeType};base64,${base64}`,
      }
    } catch (err) {
      console.error("Error reading image file:", err)
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  // ファイル存在確認ハンドラー
  ipcMain.handle("check-file-exists", async (_event, relativePath: string) => {
    try {
      const absolutePath = getAbsolutePathFromData(relativePath)
      await fs.access(absolutePath)
      return { success: true, exists: true, path: absolutePath }
    } catch (err) {
      return {
        success: true,
        exists: false,
        path: getAbsolutePathFromData(relativePath),
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })
}
