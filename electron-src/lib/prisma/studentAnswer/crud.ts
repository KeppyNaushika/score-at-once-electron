/**
 * 答案のCRUD操作
 * - アップロード、取得、削除、関連付け
 */
import * as fs from "fs/promises"
import * as path from "path"

import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
} from "../../../../src/types/omr.types"
import {
  getAbsolutePathFromData,
  getAnswerSheetsDirectory,
  getDataDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import { detectCornerMarkers } from "../../omr/cornerMarkerDetector"
import { correctImage } from "../../omr/imageCorrector"
import { recordAuditLog } from "../auditLog"
import { resolveExamScope, resolveExamScopeByPage } from "../auditScope"
import prisma from "../client"

/** ページごとのマスターマーカーキャッシュ */
type MasterMarkerInfo = {
  markers: DetectedCornerMarker[]
  width: number
  height: number
}

/**
 * マスター画像のマーカーを取得（ExamPage ごとに id でキャッシュ）
 */
async function getMasterMarkersForExamPage(
  examPageId: string,
  cache: Map<string, MasterMarkerInfo | null>,
  colorThreshold: number = 128
): Promise<MasterMarkerInfo | null> {
  if (cache.has(examPageId)) {
    return cache.get(examPageId) ?? null
  }

  const masterImage = await prisma.masterImage.findFirst({
    where: { examPageId },
  })

  if (!masterImage) {
    cache.set(examPageId, null)
    return null
  }

  const dataDir = getDataDirectory()
  const imagePath = path.join(dataDir, masterImage.imagePath)
  const result: MarkerDetectionResult = await detectCornerMarkers(
    imagePath,
    colorThreshold
  )

  if (!result.success) {
    cache.set(examPageId, null)
    return null
  }

  const info: MasterMarkerInfo = {
    markers: result.markers,
    width: result.imageWidth,
    height: result.imageHeight,
  }
  cache.set(examPageId, info)
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
    examPageId: string
    overwrite?: boolean
    correctWithMarkers?: boolean
  }[]
) {
  try {
    // 配置先 ExamPage が当該試験に属することを書き込み前に検証する。
    // （id 直指定に切り替えたため、他教員のページ削除等で stale な examPageId が来ると
    //  raw な FK エラーで途中まで書き込んだ部分適用になる。ここで早期に弾く。
    //  applyStudentAnswerPlacements と同じく id 一次検証。）
    const requestedExamPageIds = [
      ...new Set(filesData.map((fileData) => fileData.examPageId)),
    ]
    const validExamPages = await prisma.examPage.findMany({
      where: { examId, id: { in: requestedExamPageIds } },
      select: { id: true },
    })
    const validExamPageIds = new Set(validExamPages.map((page) => page.id))
    const staleExamPageId = requestedExamPageIds.find(
      (examPageId) => !validExamPageIds.has(examPageId)
    )
    if (staleExamPageId) {
      return {
        success: false,
        error:
          "配置先ページが見つかりません（他の教員がページを変更した可能性があります）。ページを再読み込みしてください。",
      }
    }

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

    // 補正用のマスターマーカーキャッシュ（examPageId→マーカー情報）
    const masterMarkerCache = new Map<string, MasterMarkerInfo | null>()

    // ================================================================
    // Phase 1: 画像補正を並列実行（CPU集中処理）
    // ================================================================
    // マスターマーカーキャッシュの初期化（全 ExamPage 分を事前取得）
    const examPageIds = [
      ...new Set(filesData.map((fileData) => fileData.examPageId)),
    ]
    await Promise.all(
      examPageIds.map((examPageId) =>
        getMasterMarkersForExamPage(examPageId, masterMarkerCache)
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
          const masterInfo = masterMarkerCache.get(fileData.examPageId)

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

      // 配置先 ExamPage は id 直指定（列＝ExamPage 実体から供給される）。
      // pageNumber からの find/create はしない（id 一次同定）。
      const existingRecord = await prisma.studentAnswerImage.findFirst({
        where: {
          examPageId: fileData.examPageId,
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
            examPageId: fileData.examPageId,
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

    if (uploadedSheets.length > 0) {
      const scope = await resolveExamScope(examId)
      await recordAuditLog({
        action: "exam.answer.upload",
        entityType: "StudentAnswerImage",
        entityId: examId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary: `生徒答案を${uploadedSheets.length}件アップロードしました`,
        extra: { count: uploadedSheets.length },
      })
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
    for (const studentAnswerImage of studentAnswerImages) {
      const key = `${studentAnswerImage.studentId}-${studentAnswerImage.examPageId}`
      const existing = seen.get(key)
      if (
        !existing ||
        new Date(studentAnswerImage.updatedAt) > new Date(existing.updatedAt)
      ) {
        seen.set(key, studentAnswerImage)
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
 * 06 生徒答案ページ専用の複合データセット（Exam 根の 1 include）。
 *
 * 行＝examStudents（ExamStudent 実体）／列＝examPages（ExamPage 実体）／
 * セル＝examPages[].studentAnswerImages（実体）という entity-first の供給。
 * Prisma の include が作るグラフをそのまま返し、renderer は射影せず保持する
 * （pageNumber・氏名は表示時にエンティティから導出する）。
 * 05/07/08 が共有する getStudentsForExam / getStudentAnswersByExamId は変更しない。
 */
export async function getStudentAnswersDataset(examId: string) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examStudents: {
          orderBy: [
            { customOrder: "asc" },
            { student: { studentNumber: "asc" } },
          ],
          include: {
            student: {
              include: {
                memberships: { include: { classroom: true } },
                _count: { select: { studentAnswerImages: true } },
              },
            },
          },
        },
        examPages: {
          orderBy: { pageNumber: "asc" },
          include: {
            studentAnswerImages: { include: { student: true } },
          },
        },
      },
    })

    if (!exam) {
      return { success: false as const, error: "試験が見つかりません" }
    }

    // 重複除去フォールバック（@@unique 適用前データ・NAS sync 由来の重複対策）。
    // getStudentAnswersByExamId と同じ (studentId, examPageId) 単位で updatedAt 最新のみ残す。
    // 05/07/08（getStudentAnswersByExamId 経由）と 06 で表示が食い違わないようにする。
    const examPages = exam.examPages.map((examPage) => {
      const latestByStudentId = new Map<
        string,
        (typeof examPage.studentAnswerImages)[number]
      >()
      for (const answerImage of examPage.studentAnswerImages) {
        const existing = latestByStudentId.get(answerImage.studentId)
        if (
          !existing ||
          new Date(answerImage.updatedAt) > new Date(existing.updatedAt)
        ) {
          latestByStudentId.set(answerImage.studentId, answerImage)
        }
      }
      return {
        ...examPage,
        studentAnswerImages: Array.from(latestByStudentId.values()),
      }
    })

    return {
      success: true as const,
      examStudents: exam.examStudents,
      examPages,
    }
  } catch (error) {
    console.error("Error fetching student answers dataset:", error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "答案データセットの取得に失敗しました",
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

    const scope = await resolveExamScopeByPage(answerSheet.examPageId)
    await recordAuditLog({
      action: "exam.answer.delete",
      entityType: "StudentAnswerImage",
      entityId: answerSheetId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
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

    const studentName = answerSheet.student
      ? `${answerSheet.student.lastName} ${answerSheet.student.firstName}`.trim()
      : null
    await recordAuditLog({
      action: "exam.answer.assign",
      entityType: "StudentAnswerImage",
      entityId: answerSheetId,
      scopeId: answerSheet.examPage.examId,
      scopeLabel: answerSheet.examPage.exam?.examName ?? null,
      target: studentName,
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
