/**
 * 答案のCRUD操作
 * - アップロード、取得、削除、関連付け
 */
import * as fs from "fs/promises"
import * as path from "path"

import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
} from "../../../../types/omr.types"
import {
  getAbsolutePathFromData,
  getAnswerSheetsDirectory,
  getDataDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import { detectCornerMarkers } from "../../omr/cornerMarkerDetector"
import { correctImage } from "../../omr/imageCorrector"
import prisma from "../client"

/** ページごとのマスターマーカーキャッシュ */
type MasterMarkerInfo = {
  markers: DetectedCornerMarker[]
  width: number
  height: number
}

/**
 * マスター画像のマーカーを取得（ページごとにキャッシュ）
 */
async function getMasterMarkersForPage(
  examId: string,
  pageNumber: number,
  cache: Map<number, MasterMarkerInfo | null>,
  colorThreshold: number = 128
): Promise<MasterMarkerInfo | null> {
  if (cache.has(pageNumber)) {
    return cache.get(pageNumber) ?? null
  }

  const masterImage = await prisma.masterImage.findFirst({
    where: {
      examPage: { examId, pageNumber },
    },
    include: { examPage: true },
  })

  if (!masterImage) {
    cache.set(pageNumber, null)
    return null
  }

  const dataDir = getDataDirectory()
  const imagePath = path.join(dataDir, masterImage.imagePath)
  const result: MarkerDetectionResult = await detectCornerMarkers(
    imagePath,
    colorThreshold
  )

  if (!result.success) {
    cache.set(pageNumber, null)
    return null
  }

  const info: MasterMarkerInfo = {
    markers: result.markers,
    width: result.imageWidth,
    height: result.imageHeight,
  }
  cache.set(pageNumber, info)
  return info
}

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
    correctWithMarkers?: boolean
  }[]
) {
  try {
    const examDir = getAnswerSheetsDirectory(examId)

    // 試験ディレクトリを作成
    await fs.mkdir(examDir, { recursive: true })

    const uploadedSheets: Array<{
      id: string
      imagePath: string
      isOverwrite: boolean
      correctionStatus: "corrected" | "skipped" | "not_requested"
      correctionError?: string
    }> = []

    // 補正用のマスターマーカーキャッシュ（ページ番号→マーカー情報）
    const masterMarkerCache = new Map<number, MasterMarkerInfo | null>()

    // ================================================================
    // Phase 1: 画像補正を並列実行（CPU集中処理）
    // ================================================================
    // マスターマーカーキャッシュの初期化（全ページ分を事前取得）
    const pageNumbers = [...new Set(filesData.map((f) => f.pageNumber || 1))]
    await Promise.all(
      pageNumbers.map((pn) =>
        getMasterMarkersForPage(examId, pn, masterMarkerCache)
      )
    )

    // 各ファイルの補正を並列実行
    const correctedFiles = await Promise.all(
      filesData.map(async (fileData) => {
        let buffer = Buffer.from(fileData.buffer)
        let correctionStatus: "corrected" | "skipped" | "not_requested" =
          "not_requested"
        let correctionError: string | undefined

        if (fileData.correctWithMarkers) {
          const masterInfo = masterMarkerCache.get(fileData.pageNumber || 1)

          if (masterInfo) {
            const result = await correctImage(
              buffer,
              masterInfo.markers,
              masterInfo.width,
              masterInfo.height
            )

            if (result.success && result.correctedBuffer) {
              buffer = Buffer.from(result.correctedBuffer)
              correctionStatus = "corrected"
            } else {
              correctionStatus = "skipped"
              correctionError = result.error
              console.warn(
                `画像補正スキップ (${fileData.name}): ${result.error}`
              )
            }
          } else {
            correctionStatus = "skipped"
            correctionError = "マスター画像のマーカーが検出できませんでした"
          }
        }

        return { fileData, buffer, correctionStatus, correctionError }
      })
    )

    // ================================================================
    // Phase 2: DB書き込み + ファイル保存（順次実行、SQLite制約）
    // ================================================================
    for (const {
      fileData,
      buffer,
      correctionStatus,
      correctionError,
    } of correctedFiles) {
      if (!fileData.studentId) {
        throw new Error(`Student ID is required for file: ${fileData.name}`)
      }

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

      const existingRecord = await prisma.studentAnswerImage.findFirst({
        where: {
          examPageId: examPage.id,
          studentId: fileData.studentId,
        },
      })

      const timestamp = Date.now()
      const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
      const fileName = `${timestamp}_${sanitizedName}`
      const filePath = path.join(examDir, fileName)
      const relativePath = getRelativePathFromData(filePath)

      if (existingRecord) {
        if (fileData.overwrite) {
          await fs.writeFile(filePath, buffer)

          try {
            const oldFilePath = getAbsolutePathFromData(
              existingRecord.imagePath
            )
            await fs.unlink(oldFilePath)
          } catch {
            // ファイルが存在しない場合は無視
          }

          const answerSheet = await prisma.studentAnswerImage.update({
            where: { id: existingRecord.id },
            data: { imagePath: relativePath },
          })

          uploadedSheets.push({
            ...answerSheet,
            isOverwrite: true,
            correctionStatus,
            correctionError,
          })
        } else {
          uploadedSheets.push({
            ...existingRecord,
            isOverwrite: false,
            correctionStatus: "not_requested",
          })
        }
      } else {
        await fs.writeFile(filePath, buffer)

        const answerSheet = await prisma.studentAnswerImage.create({
          data: {
            examPageId: examPage.id,
            studentId: fileData.studentId,
            imagePath: relativePath,
          },
        })

        uploadedSheets.push({
          ...answerSheet,
          isOverwrite: false,
          correctionStatus,
          correctionError,
        })
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
