import * as path from 'path'
import * as fs from 'fs/promises'
import { getAnswerSheetsDirectory, getRelativePathFromData } from '../dataManager'
import prisma from './client'

// 答案画像のアップロード
export async function uploadAnswerSheets(
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
      const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, '_')
      const fileName = `${timestamp}_${sanitizedName}`
      const filePath = path.join(projectDir, fileName)
      const relativePath = getRelativePathFromData(filePath)

      // ファイルを保存
      const buffer = Buffer.from(fileData.buffer)
      await fs.writeFile(filePath, buffer)

      // データベースに記録
      const answerSheet = await prisma.answerSheet.create({
        data: {
          projectId,
          studentId: fileData.studentId || null,
          pageNumber: fileData.pageNumber || 1,
          originalImagePath: relativePath, // 既にWindows対応済み
        },
        include: {
          student: true,
          project: true,
        }
      })

      uploadedSheets.push(answerSheet)
    }

    return { success: true, answerSheets: uploadedSheets }
  } catch (error) {
    console.error('Error uploading answer sheets:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '答案のアップロードに失敗しました',
    }
  }
}

// プロジェクトの答案一覧を取得
export async function getAnswerSheetsByProjectId(projectId: string) {
  try {
    const answerSheets = await prisma.answerSheet.findMany({
      where: { projectId },
      include: {
        student: true,
        project: true,
        questionScores: {
          include: {
            layoutRegion: true,
            scoredByUser: true,
          }
        }
      },
      orderBy: [
        { studentId: 'asc' },
        { pageNumber: 'asc' },
      ]
    })

    return { success: true, answerSheets }
  } catch (error) {
    console.error('Error fetching answer sheets:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '答案の取得に失敗しました',
    }
  }
}

// 答案の削除
export async function deleteAnswerSheet(answerSheetId: string) {
  try {
    const answerSheet = await prisma.answerSheet.findUnique({
      where: { id: answerSheetId }
    })

    if (!answerSheet) {
      throw new Error('答案が見つかりません')
    }

    // ファイルを削除
    const { getAbsolutePathFromData } = await import('../dataManager')
    const filePath = getAbsolutePathFromData(answerSheet.originalImagePath)
    
    try {
      await fs.unlink(filePath)
    } catch (fileError) {
      console.warn('Failed to delete file:', fileError)
    }

    // データベースから削除
    await prisma.answerSheet.delete({
      where: { id: answerSheetId }
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting answer sheet:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '答案の削除に失敗しました',
    }
  }
}

// 答案と生徒の関連付け
export async function associateAnswerSheetWithStudent(
  answerSheetId: string,
  studentId: string
) {
  try {
    const answerSheet = await prisma.answerSheet.update({
      where: { id: answerSheetId },
      data: { studentId },
      include: {
        student: true,
        project: true,
      }
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error('Error associating answer sheet with student:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '生徒との関連付けに失敗しました',
    }
  }
}

// 答案の欠席状態を設定
export async function setAnswerSheetAbsent(answerSheetId: string, isAbsent: boolean) {
  try {
    const answerSheet = await prisma.answerSheet.update({
      where: { id: answerSheetId },
      data: { isAbsent },
      include: {
        student: true,
        project: true,
      }
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error('Error setting answer sheet absent status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '欠席状態の設定に失敗しました',
    }
  }
}

// 答案の詳細情報を取得
export async function getAnswerSheetById(answerSheetId: string) {
  try {
    const answerSheet = await prisma.answerSheet.findUnique({
      where: { id: answerSheetId },
      include: {
        student: true,
        project: {
          include: {
            layoutRegions: true,
          }
        },
        questionScores: {
          include: {
            layoutRegion: true,
            scoredByUser: true,
          }
        }
      }
    })

    if (!answerSheet) {
      throw new Error('答案が見つかりません')
    }

    return { success: true, answerSheet }
  } catch (error) {
    console.error('Error fetching answer sheet:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '答案の取得に失敗しました',
    }
  }
}