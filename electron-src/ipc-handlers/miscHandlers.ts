import type { Prisma } from "@prisma/client"
import * as fsPromises from "fs/promises"

import { getAbsolutePathFromData } from "../lib/dataManager"
import {
  createClassroom,
  deleteClassroom,
  fetchClassrooms,
  updateClassroom,
} from "../lib/prisma/classroom"
import {
  deleteMasterAnswer,
  getMasterAnswersByExamId,
  type MasterAnswerFileData,
  replaceMasterAnswerImage,
  updateExamPagePageSize,
  updateMasterAnswersOrder,
  uploadMasterAnswers,
} from "../lib/prisma/masterAnswer"
import {
  deleteStudentAnswer,
  getStudentAnswersByExamId,
  getStudentAnswerScoreSummary,
  getStudentAnswersDataset,
  uploadStudentAnswers,
} from "../lib/prisma/studentAnswer/crud"
import {
  applyStudentAnswerPlacements,
  type StudentAnswerPlacementMove,
} from "../lib/prisma/studentAnswer/placementApply"
import {
  createUser,
  fetchUsers,
  getCurrentUser,
  updateUser,
  updateUserPasscode,
  verifyPasscode,
} from "../lib/prisma/user"
import { registerHandler } from "./ipcHandlerUtils"

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
      return await createUser({
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
      return await verifyPasscode(userId, passcode)
    }
  )

  registerHandler(
    "update-user",
    async (userId: string, userData: { username?: string; name?: string }) => {
      return await updateUser(userId, userData)
    }
  )

  registerHandler(
    "update-user-passcode",
    async (userId: string, passcode?: string, passcodeType?: string) => {
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
        examStudentId?: string
        examPageId: string
        overwrite?: boolean
        correctWithMarkers?: boolean
      }[]
    ) => {
      return await uploadStudentAnswers(examId, filesData)
    }
  )

  registerHandler("get-answer-sheets-by-exam-id", (examId: string) =>
    getStudentAnswersByExamId(examId)
  )

  // 06 生徒答案ページ専用の複合データセット（Exam 根の 1 include）
  registerHandler("get-student-answers-dataset", (examId: string) =>
    getStudentAnswersDataset(examId)
  )

  // 削除確認モーダルで「何が消えるか」を提示するための事前照会
  registerHandler("get-answer-sheet-score-summary", (answerSheetId: string) =>
    getStudentAnswerScoreSummary(answerSheetId)
  )

  registerHandler("delete-answer-sheet", async (answerSheetId: string) => {
    return await deleteStudentAnswer(answerSheetId)
  })

  registerHandler(
    "apply-answer-sheet-placements",
    async (moves: StudentAnswerPlacementMove[]) => {
      await applyStudentAnswerPlacements(moves)
    }
  )

  // Classroom handlers
  registerHandler("fetch-classrooms", async () => {
    return await fetchClassrooms()
  })

  registerHandler(
    "create-class",
    async (classroomData: Prisma.ClassroomCreateInput) => {
      return await createClassroom(classroomData)
    }
  )

  registerHandler(
    "update-class",
    async (classroomData: Prisma.ClassroomUpdateInput & { id: string }) => {
      return await updateClassroom(classroomData)
    }
  )

  registerHandler("delete-class", async (classroomId: string) => {
    return await deleteClassroom(classroomId)
  })

  // 模範解答ページ（ExamPage）のハンドラ。id はすべて ExamPage.id
  registerHandler(
    "upload-master-answers",
    async (examId: string, filesData: MasterAnswerFileData[]) => {
      return await uploadMasterAnswers(examId, filesData)
    }
  )

  registerHandler(
    "replace-master-answer-image",
    async (examPageId: string, fileData: MasterAnswerFileData) => {
      return await replaceMasterAnswerImage(examPageId, fileData)
    }
  )

  registerHandler("delete-master-answer", async (examPageId: string) => {
    return await deleteMasterAnswer(examPageId)
  })

  registerHandler(
    "update-master-answers-order",
    async (pageOrders: { id: string; pageNumber: number }[]) => {
      return await updateMasterAnswersOrder(pageOrders)
    }
  )

  registerHandler(
    "update-exam-page-page-size",
    async (examPageId: string, pageSize: string) => {
      return await updateExamPagePageSize(examPageId, pageSize)
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

  registerHandler("get-student-answer-images-by-exam-id", (examId: string) =>
    getStudentAnswersByExamId(examId)
  )

  registerHandler("get-master-images-by-exam-id", async (examId: string) => {
    return await getMasterAnswersByExamId(examId)
  })

  // 画像ファイル読み込みハンドラー
  registerHandler("get-image-data", async (relativePath: string) => {
    const absolutePath = getAbsolutePathFromData(relativePath)
    const imageBuffer = await fsPromises.readFile(absolutePath)
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

    return `data:${mimeType};base64,${base64}`
  })

  // ファイル存在確認ハンドラー
  // 存在しないことは失敗ではないので、例外にせず値で返す
  registerHandler("check-file-exists", async (relativePath: string) => {
    const absolutePath = getAbsolutePathFromData(relativePath)
    try {
      await fsPromises.access(absolutePath)
      return { exists: true, path: absolutePath }
    } catch {
      return { exists: false, path: absolutePath }
    }
  })
}
