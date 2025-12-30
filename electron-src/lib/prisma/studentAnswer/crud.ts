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

      // studentIdが必須の場合のみ処理を継続
      if (!fileData.studentId) {
        throw new Error(`Student ID is required for file: ${fileData.name}`)
      }

      // TODO: Fix this for new schema
      // 既存レコードの確認
      const existingRecord = null // await prisma.pageImage.findFirst({
      //   where: {
      //     projectPageId: projectPageId,
      //     studentId: fileData.studentId,
      //     imageType: "STUDENT_ANSWER"
      //   },
      // })

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

      // データベースに記録（upsertで重複回避）
      const answerSheet = await prisma.pageImage.create({
        data: {
          projectPageId: projectPage.id, // Now using correct ProjectPage.id
          studentId: fileData.studentId,
          imagePath: relativePath,
          imageType: "STUDENT_ANSWER",
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
 */
export async function getStudentAnswersByProjectId(projectId: string) {
  try {
    const answerSheets = await prisma.pageImage.findMany({
      where: {
        imageType: "STUDENT_ANSWER",
        projectPage: {
          projectId: projectId,
        },
        studentId: { not: null }, // Only include images with assigned students
      },
      include: {
        student: {
          include: {
            projectStudents: {
              where: { projectId },
              select: { customOrder: true, status: true }, // Include status to determine if absent
            },
          },
        },
        projectPage: {
          include: {
            project: true,
          },
        },
      },
      orderBy: [{ studentId: "asc" }, { projectPage: { pageNumber: "asc" } }],
    })

    // Transform PageImage data to legacy format for backward compatibility
    const processedAnswerSheets = answerSheets
      .filter((sheet) => sheet.student) // Ensure student exists
      .map((sheet) => {
        // Get ProjectStudent status to determine if absent
        const projectStudent = sheet.student?.projectStudents?.[0]
        const isAbsent = projectStudent?.status === "ABSENT"

        return {
          id: sheet.id,
          studentId: sheet.studentId,
          pageNumber: sheet.projectPage.pageNumber,
          projectPageId: sheet.projectPage.id, // Add projectPageId for page filtering
          imagePath: sheet.imagePath, // Keep imagePath for UI compatibility
          originalImagePath: sheet.imagePath, // Map imagePath to originalImagePath for backward compatibility
          isAbsent: isAbsent, // Properly determined from ProjectStudent.status
          student: sheet.student
            ? {
                id: sheet.student.id,
                lastName: sheet.student.lastName,
                firstName: sheet.student.firstName,
                lastNameKana: sheet.student.lastNameKana,
                firstNameKana: sheet.student.firstNameKana,
                studentId: sheet.student.studentId,
                projectStudents: sheet.student.projectStudents, // Include projectStudents for customOrder access
              }
            : null,
          projectId: sheet.projectPage.project.id,
          status: "ready" as const,
        }
      })

    return { success: true, answerSheets: processedAnswerSheets }
  } catch (error) {
    console.error("Error fetching answer sheets:", error)
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
    const answerSheet = await prisma.pageImage.findUnique({
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
    await prisma.pageImage.delete({
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
    const answerSheet = await prisma.pageImage.update({
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
    const answerSheet = await prisma.pageImage.findUnique({
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
        // TODO: questionScores would need to be fetched separately in new schema
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
