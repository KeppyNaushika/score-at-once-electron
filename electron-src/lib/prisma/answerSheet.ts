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
        student: {
          include: {
            projectStudents: {
              where: { projectId },
              select: { customOrder: true }
            }
          }
        },
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

// 答案の配置情報を更新（生徒ID・ページ番号）
export async function updateAnswerSheetPlacement(
  answerSheetId: string,
  studentId: string | null,
  pageNumber: number
) {
  try {
    // まず現在の答案情報を取得してprojectIdを確認
    const currentAnswerSheet = await prisma.answerSheet.findUnique({
      where: { id: answerSheetId },
      select: { projectId: true }
    })

    if (!currentAnswerSheet) {
      throw new Error('答案が見つかりません')
    }

    const answerSheet = await prisma.answerSheet.update({
      where: { id: answerSheetId },
      data: {
        studentId,
        pageNumber,
      },
      include: {
        student: {
          include: {
            projectStudents: {
              where: { projectId: currentAnswerSheet.projectId },
              select: { customOrder: true }
            }
          }
        },
        project: true,
        questionScores: {
          include: {
            layoutRegion: true,
            scoredByUser: true,
          }
        }
      }
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error('Error updating answer sheet placement:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '答案の配置更新に失敗しました',
    }
  }
}

// 2つの答案の配置を交換（ユニーク制約を考慮した安全な交換）
export async function swapAnswerSheetPlacements(
  answerSheetId1: string,
  answerSheetId2: string
) {
  try {
    // トランザクション内で答案交換を実行
    const result = await prisma.$transaction(async (tx) => {
      // 2つの答案の現在の配置情報を取得
      const [answerSheet1, answerSheet2] = await Promise.all([
        tx.answerSheet.findUnique({
          where: { id: answerSheetId1 },
          select: { studentId: true, pageNumber: true, projectId: true }
        }),
        tx.answerSheet.findUnique({
          where: { id: answerSheetId2 },
          select: { studentId: true, pageNumber: true, projectId: true }
        })
      ])

      if (!answerSheet1 || !answerSheet2) {
        throw new Error('答案が見つかりません')
      }

      // 一時的にanswerSheet1をnull配置に移動（制約回避）
      await tx.answerSheet.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: null,
          pageNumber: -1, // 一時的な値
        }
      })

      // answerSheet2をanswerSheet1の元の位置に移動
      await tx.answerSheet.update({
        where: { id: answerSheetId2 },
        data: {
          studentId: answerSheet1.studentId,
          pageNumber: answerSheet1.pageNumber,
        }
      })

      // answerSheet1をanswerSheet2の元の位置に移動
      await tx.answerSheet.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: answerSheet2.studentId,
          pageNumber: answerSheet2.pageNumber,
        }
      })

      // 更新後の答案情報を取得
      const [updatedAnswerSheet1, updatedAnswerSheet2] = await Promise.all([
        tx.answerSheet.findUnique({
          where: { id: answerSheetId1 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet1.projectId },
                  select: { customOrder: true }
                }
              }
            },
            project: true,
            questionScores: {
              include: {
                layoutRegion: true,
                scoredByUser: true,
              }
            }
          }
        }),
        tx.answerSheet.findUnique({
          where: { id: answerSheetId2 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet2.projectId },
                  select: { customOrder: true }
                }
              }
            },
            project: true,
            questionScores: {
              include: {
                layoutRegion: true,
                scoredByUser: true,
              }
            }
          }
        })
      ])

      return { updatedAnswerSheet1, updatedAnswerSheet2 }
    })

    return { 
      success: true, 
      answerSheets: [result.updatedAnswerSheet1, result.updatedAnswerSheet2] 
    }
  } catch (error) {
    console.error('Error swapping answer sheet placements:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '答案の配置交換に失敗しました',
    }
  }
}