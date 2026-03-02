/**
 * 答案のCRUD操作
 * - アップロード、取得、削除、関連付け
 */
import * as fs from "fs/promises"
import * as path from "path"

import {
  getAbsolutePathFromData,
  getAnswerSheetsDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import prisma from "../client"

/**
 * 答案画像のアップロード
 */
export async function uploadStudentAnswers(
  examId: string,
  filesData: {
    name: string
    type: string
    buffer: ArrayBuffer
    studentId?: string
    pageNumber?: number
    overwrite?: boolean
  }[]
) {
  try {
    const examDir = getAnswerSheetsDirectory(examId)

    // 試験ディレクトリを作成
    await fs.mkdir(examDir, { recursive: true })

    const uploadedSheets = []

    for (const fileData of filesData) {
      // studentIdが必須
      if (!fileData.studentId) {
        throw new Error(`Student ID is required for file: ${fileData.name}`)
      }

      // Find or create the appropriate ExamPage for this pageNumber
      let examPage = await prisma.examPage.findFirst({
        where: {
          examId: examId,
          pageNumber: fileData.pageNumber || 1,
        },
      })

      if (!examPage) {
        examPage = await prisma.examPage.create({
          data: {
            examId: examId,
            pageNumber: fileData.pageNumber || 1,
          },
        })
      }

      // 既存レコードの確認
      const existingRecord = await prisma.studentAnswerImage.findFirst({
        where: {
          examPageId: examPage.id,
          studentId: fileData.studentId,
        },
      })

      // ファイル名を正規化
      const timestamp = Date.now()
      const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
      const fileName = `${timestamp}_${sanitizedName}`
      const filePath = path.join(examDir, fileName)
      const relativePath = getRelativePathFromData(filePath)

      if (existingRecord) {
        if (fileData.overwrite) {
          // ファイルを保存
          const buffer = Buffer.from(fileData.buffer)
          await fs.writeFile(filePath, buffer)

          // 古いファイルを削除
          try {
            const oldFilePath = getAbsolutePathFromData(
              existingRecord.imagePath
            )
            await fs.unlink(oldFilePath)
          } catch {
            // ファイルが存在しない場合は無視
          }

          // レコードを更新
          const answerSheet = await prisma.studentAnswerImage.update({
            where: { id: existingRecord.id },
            data: { imagePath: relativePath },
          })

          uploadedSheets.push({ ...answerSheet, isOverwrite: true })
        } else {
          // 上書き無効: スキップ（既存レコードをそのまま返す）
          uploadedSheets.push({ ...existingRecord, isOverwrite: false })
        }
      } else {
        // ファイルを保存
        const buffer = Buffer.from(fileData.buffer)
        await fs.writeFile(filePath, buffer)

        // 新規作成
        const answerSheet = await prisma.studentAnswerImage.create({
          data: {
            examPageId: examPage.id,
            studentId: fileData.studentId,
            imagePath: relativePath,
          },
        })

        uploadedSheets.push({ ...answerSheet, isOverwrite: false })
      }
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
 * 試験の答案一覧を取得
 * Prismaの型をそのまま返す（StudentAnswerImageWithExamStudents互換）
 */
export async function getStudentAnswersByExamId(examId: string) {
  try {
    const studentAnswerImages = await prisma.studentAnswerImage.findMany({
      where: {
        examPage: {
          examId: examId,
        },
      },
      include: {
        student: {
          include: {
            examStudents: {
              where: { examId },
            },
          },
        },
        examPage: true,
      },
      orderBy: [{ studentId: "asc" }, { examPage: { pageNumber: "asc" } }],
    })

    // 重複除去フォールバック（@@unique制約適用前のデータ対策）
    const seen = new Map<string, (typeof studentAnswerImages)[0]>()
    for (const img of studentAnswerImages) {
      const key = `${img.studentId}-${img.examPageId}`
      const existing = seen.get(key)
      if (!existing || new Date(img.updatedAt) > new Date(existing.updatedAt)) {
        seen.set(key, img)
      }
    }
    const deduplicated = Array.from(seen.values())

    return { success: true, studentAnswerImages: deduplicated }
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
        examPage: {
          include: {
            exam: true,
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
        examPage: {
          include: {
            exam: {
              include: {
                examPages: {
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
