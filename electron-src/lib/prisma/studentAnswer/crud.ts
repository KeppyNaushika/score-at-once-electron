/**
 * 答案のCRUD操作
 * - アップロード、取得、削除、関連付け
 */
import * as fs from "fs/promises"
import * as path from "path"

import {
  getAnswerSheetsDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import prisma from "../client"

/**
 * 答案画像のアップロード
 */
export async function uploadStudentAnswers(
  projectId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    studentId?: string
    pageNumber?: number
  }[]
) {
  try {
    const projectDir = getAnswerSheetsDirectory(projectId)

    // プロジェクトディレクトリを作成
    await fs.mkdir(projectDir, { recursive: true })

    const uploadedSheets = []

    for (const fileData of filesData) {
      // ファイル名を正規化
      const timestamp = Date.now()
      const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
      const fileName = `${timestamp}_${sanitizedName}`
      const filePath = path.join(projectDir, fileName)
      const relativePath = getRelativePathFromData(filePath)

      // ファイルを保存
      const buffer = Buffer.from(fileData.buffer)
      await fs.writeFile(filePath, buffer)

      // studentIdが必須
      if (!fileData.studentId) {
        throw new Error(`Student ID is required for file: ${fileData.name}`)
      }

      // Find or create the appropriate ProjectPage for this pageNumber
      let projectPage = await prisma.projectPage.findFirst({
        where: {
          projectId: projectId,
          pageNumber: fileData.pageNumber || 1,
        },
      })

      if (!projectPage) {
        projectPage = await prisma.projectPage.create({
          data: {
            projectId: projectId,
            pageNumber: fileData.pageNumber || 1,
          },
        })
      }

      // 既存レコードの確認
      const existingRecord = await prisma.studentAnswerImage.findFirst({
        where: {
          projectPageId: projectPage.id,
          studentId: fileData.studentId,
        },
      })

      // データベースに記録
      const answerSheet = await prisma.studentAnswerImage.create({
        data: {
          projectPageId: projectPage.id,
          studentId: fileData.studentId,
          imagePath: relativePath,
        },
      })

      // 上書きフラグを追加
      const resultSheet = {
        ...answerSheet,
        isOverwrite: !!existingRecord,
      }

      uploadedSheets.push(resultSheet)
    }

    return { success: true, answerSheets: uploadedSheets }
  } catch (error) {
    console.error("Error uploading answer sheets:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "答案のアップロードに失敗しました",
    }
  }
}

/**
 * プロジェクトの答案一覧を取得
 * Prismaの型をそのまま返す（StudentAnswerImageWithProjectStudents互換）
 */
export async function getStudentAnswersByProjectId(projectId: string) {
  try {
    const studentAnswerImages = await prisma.studentAnswerImage.findMany({
      where: {
        projectPage: {
          projectId: projectId,
        },
      },
      include: {
        student: {
          include: {
            projectStudents: {
              where: { projectId },
            },
          },
        },
        projectPage: true,
      },
      orderBy: [{ studentId: "asc" }, { projectPage: { pageNumber: "asc" } }],
    })

    return { success: true, studentAnswerImages }
  } catch (error) {
    console.error("Error fetching student answer images:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の取得に失敗しました",
    }
  }
}

/**
 * 答案の削除
 */
export async function deleteStudentAnswer(answerSheetId: string) {
  try {
    const answerSheet = await prisma.studentAnswerImage.findUnique({
      where: { id: answerSheetId },
    })

    if (!answerSheet) {
      throw new Error("答案が見つかりません")
    }

    // ファイルを削除
    const { getAbsolutePathFromData } = await import("../../dataManager")
    const filePath = getAbsolutePathFromData(answerSheet.imagePath)

    try {
      await fs.unlink(filePath)
    } catch (fileError) {
      console.warn("Failed to delete file:", fileError)
    }

    // データベースから削除
    await prisma.studentAnswerImage.delete({
      where: { id: answerSheetId },
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting answer sheet:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の削除に失敗しました",
    }
  }
}

/**
 * 答案と生徒の関連付け
 */
export async function associateStudentAnswerWithStudent(
  answerSheetId: string,
  studentId: string
) {
  try {
    const answerSheet = await prisma.studentAnswerImage.update({
      where: { id: answerSheetId },
      data: { studentId },
      include: {
        student: true,
        projectPage: {
          include: {
            project: true,
          },
        },
      },
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error associating answer sheet with student:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "生徒との関連付けに失敗しました",
    }
  }
}

/**
 * 答案の詳細情報を取得
 */
export async function getStudentAnswerById(answerSheetId: string) {
  try {
    const answerSheet = await prisma.studentAnswerImage.findUnique({
      where: { id: answerSheetId },
      include: {
        student: true,
        projectPage: {
          include: {
            project: {
              include: {
                projectPages: {
                  include: {
                    cropRegions: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!answerSheet) {
      throw new Error("答案が見つかりません")
    }

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error fetching answer sheet:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の取得に失敗しました",
    }
  }
}
