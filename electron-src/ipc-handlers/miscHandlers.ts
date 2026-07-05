import { Prisma } from "@prisma/client"
import * as fs from "fs/promises"

import { getAbsolutePathFromData } from "../lib/dataManager"
import {
  createClass,
  deleteClass,
  fetchClasses,
  updateClass,
} from "../lib/prisma/classroom"
import {
  deleteMasterAnswer,
  getMasterAnswersByExamId,
  updateMasterAnswersOrder,
  updateMasterImagePageSize,
  uploadMasterAnswers,
} from "../lib/prisma/masterAnswer"
import {
  associateStudentAnswerWithStudent,
  batchUpdateStudentAnswerPlacements,
  deleteStudentAnswer,
  getStudentAnswerById,
  getStudentAnswersByExamId,
  setStudentAnswerAbsent,
  swapStudentAnswerPlacements,
  swapStudentAnswerPlacementsWithScoring,
  updateStudentAnswerPlacement,
  uploadStudentAnswers,
} from "../lib/prisma/studentAnswer"
import {
  createUser as createUserWithPasscode,
  fetchUsers,
  getCurrentUser,
} from "../lib/prisma/user"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** ユーザー・認証・答案・学級・模範画像・ファイル操作など汎用的なIPCチャンネルを登録する */
export function setupMiscHandlers(): void {
  // User handlers
  registerHandler("fetch-users", async () => {
    return await fetchUsers()
  })

  registerHandler("get-current-user", async () => {
    return await getCurrentUser()
  })

  // User creation handler
  registerHandler(
    "create-user",
    async (userData: {
      username: string
      name: string
      passcode?: string
      passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
    }) => {
      return await createUserWithPasscode({
        username: userData.username,
        name: userData.name,
        passcode: userData.passcode,
        passcodeType: userData.passcodeType,
      })
    }
  )

  registerHandler(
    "verify-passcode",
    async (userId: string, passcode: string) => {
      const { verifyPasscode } = await import("../lib/prisma/user")
      return await verifyPasscode(userId, passcode)
    }
  )

  registerHandler(
    "update-user",
    async (userId: string, userData: { username?: string; name?: string }) => {
      const { updateUser } = await import("../lib/prisma/user")
      return await updateUser(userId, userData)
    }
  )

  registerHandler(
    "update-user-passcode",
    async (userId: string, passcode?: string, passcodeType?: string) => {
      const { updateUserPasscode } = await import("../lib/prisma/user")
      return await updateUserPasscode(
        userId,
        passcode,
        passcodeType as "none" | "4digit" | "6digit" | "alphanumeric"
      )
    }
  )

  // Answer sheet handlers
  registerHandler(
    "upload-answer-sheets",
    async (
      examId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        studentId?: string
        pageNumber?: number
        overwrite?: boolean
        correctWithMarkers?: boolean
      }[]
    ) => {
      return await uploadStudentAnswers(examId, filesData)
    }
  )

  registerSafeHandler(
    "get-answer-sheets-by-exam-id",
    async (examId: string) => {
      const result = await getStudentAnswersByExamId(examId)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return {
        success: true,
        studentAnswerImages: result.studentAnswerImages ?? [],
      }
    }
  )

  registerHandler("delete-answer-sheet", async (answerSheetId: string) => {
    return await deleteStudentAnswer(answerSheetId)
  })

  registerHandler(
    "associate-answer-sheet-with-student",
    async (answerSheetId: string, studentId: string) => {
      return await associateStudentAnswerWithStudent(answerSheetId, studentId)
    }
  )

  registerHandler(
    "set-answer-sheet-absent",
    async (answerSheetId: string, isAbsent: boolean) => {
      return await setStudentAnswerAbsent(answerSheetId, isAbsent)
    }
  )

  registerHandler("get-answer-sheet-by-id", async (answerSheetId: string) => {
    const result = await getStudentAnswerById(answerSheetId)
    if (!result.success) {
      throw new Error(result.error)
    }
    if (!result.answerSheet) return null
    return {
      ...result.answerSheet,
    }
  })

  registerHandler(
    "update-answer-sheet-placement",
    async (
      answerSheetId: string,
      studentId: string | null,
      pageNumber: number
    ) => {
      const result = await updateStudentAnswerPlacement(
        answerSheetId,
        studentId,
        pageNumber
      )
      if (!result.success) {
        throw new Error(result.error)
      }
      return {
        ...result.answerSheet,
      }
    }
  )

  registerHandler(
    "swap-answer-sheet-placements",
    async (answerSheetId1: string, answerSheetId2: string) => {
      const result = await swapStudentAnswerPlacements(
        answerSheetId1,
        answerSheetId2
      )
      if (!result.success) {
        throw new Error(result.error)
      }
      return (result.answerSheets || [])
        .filter((sheet) => sheet !== null)
        .map((sheet) => ({
          ...sheet,
        }))
    }
  )

  registerHandler(
    "swap-answer-sheet-placements-with-scoring",
    async (answerSheetId1: string, answerSheetId2: string) => {
      const result = await swapStudentAnswerPlacementsWithScoring(
        answerSheetId1,
        answerSheetId2
      )
      if (!result.success) {
        throw new Error(result.error)
      }
      return (result.answerSheets || [])
        .filter((sheet) => sheet !== null)
        .map((sheet) => ({
          ...sheet,
        }))
    }
  )

  registerHandler(
    "batch-update-answer-sheet-placements",
    async (
      moves: Array<{
        fileId: string
        finalStudentId: string | null
        finalPageNumber: number
      }>,
      withScoring: boolean = false
    ) => {
      const result = await batchUpdateStudentAnswerPlacements(
        moves,
        withScoring
      )
      if (!result.success) {
        const errorMessage = "error" in result ? result.error : "Unknown error"
        throw new Error(errorMessage)
      }
      return result
    }
  )

  // Class handlers
  registerHandler("fetch-classes", async () => {
    return await fetchClasses()
  })

  registerHandler(
    "create-class",
    async (classData: Prisma.ClassroomCreateInput) => {
      return await createClass(classData)
    }
  )

  registerHandler(
    "update-class",
    async (classData: Prisma.ClassroomUpdateInput & { id: string }) => {
      return await updateClass(classData)
    }
  )

  registerHandler("delete-class", async (classroomId: string) => {
    return await deleteClass(classroomId)
  })

  // Master image handlers
  registerHandler(
    "upload-master-answers",
    async (
      examId: string,
      filesData: {
        name: string
        type: string
        buffer: ArrayBuffer
        path?: string
      }[]
    ) => {
      return await uploadMasterAnswers(examId, filesData)
    }
  )

  registerHandler("delete-master-answer", async (answerId: string) => {
    return await deleteMasterAnswer(answerId)
  })

  registerHandler(
    "update-master-answers-order",
    async (answerOrders: { id: string; pageNumber: number }[]) => {
      return await updateMasterAnswersOrder(answerOrders)
    }
  )

  registerHandler(
    "update-master-image-page-size",
    async (id: string, pageSize: string) => {
      return await updateMasterImagePageSize(id, pageSize)
    }
  )

  registerHandler(
    "resolve-file-protocol-path",
    async (relativePath: string) => {
      // パスを適切にエンコード
      // appimg:/// (スラッシュ3つ) にすることで、URLパース時にpathname全体が取得できる
      const encodedPath = encodeURI(relativePath)
      const result = `appimg:///${encodedPath}`

      return result
    }
  )

  registerSafeHandler("read-file-as-base64", async (filePath: string) => {
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
  })

  registerHandler(
    "get-student-answer-images-by-exam-id",
    async (examId: string) => {
      const result = await getStudentAnswersByExamId(examId)
      return result.success ? (result.studentAnswerImages ?? []) : []
    }
  )

  registerHandler("get-master-images-by-exam-id", async (examId: string) => {
    const masterAnswers = await getMasterAnswersByExamId(examId)
    // Dateオブジェクトをそのまま返す
    return masterAnswers
  })

  // Data management handlers
  registerSafeHandler("get-data-directory-info", async () => {
    const { getDataDirectory, calculateDataSize } =
      await import("../lib/dataManager")

    const dataDirectory = getDataDirectory()
    const size = await calculateDataSize()

    return {
      success: true,
      directory: dataDirectory,
      size,
    }
  })

  registerSafeHandler("open-data-directory", async () => {
    const { shell } = await import("electron")
    const { getDataDirectory } = await import("../lib/dataManager")

    const dataDirectory = getDataDirectory()
    await shell.openPath(dataDirectory)

    return { success: true }
  })

  registerSafeHandler("delete-all-data", async () => {
    const { getDataDirectory } = await import("../lib/dataManager")
    const fs = await import("fs/promises")

    const dataDirectory = getDataDirectory()

    // データフォルダを完全削除
    await fs.rm(dataDirectory, { recursive: true, force: true })

    // データディレクトリを再作成
    await fs.mkdir(dataDirectory, { recursive: true })

    return { success: true }
  })

  // 画像ファイル読み込みハンドラー
  registerSafeHandler("get-image-data", async (relativePath: string) => {
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
  })

  // ファイル存在確認ハンドラー
  registerSafeHandler("check-file-exists", async (relativePath: string) => {
    const absolutePath = getAbsolutePathFromData(relativePath)
    try {
      await fs.access(absolutePath)
      return { success: true, exists: true, path: absolutePath }
    } catch (err) {
      return {
        success: true,
        exists: false,
        path: absolutePath,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  })

  // アセットパス解決ハンドラー
  registerSafeHandler("get-asset-path", async (assetPath: string) => {
    const { app } = require("electron")
    const path = require("path")

    // パッケージ化されたアプリかどうかで分岐
    const publicDir = app.isPackaged
      ? path.join(app.getAppPath(), "public")
      : path.join(process.cwd(), "public")

    const fullPath = path.join(publicDir, assetPath)

    // appimg:/// プロトコルを使用してパスを返す（webSecurity有効時のローカルファイルアクセス用）
    return { success: true, path: `appimg:///${fullPath}` }
  })
}
