/**
 * 答案画像のアップロード（任意でコーナーマーカーによる画像補正を掛ける）
 */
import * as fsPromises from "fs/promises"
import * as path from "path"

import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
} from "../../../../src/types/omr.types"
import {
  getAbsolutePathFromSharedFiles,
  getAnswerSheetsDirectory,
  getRelativePathFromSharedFiles,
  getSharedFilesDirectory,
} from "../../dataManager"
import { detectCornerMarkers } from "../../omr/cornerMarkerDetector"
import { correctImage } from "../../omr/imageCorrector"
import { recordAuditLog } from "../auditLog"
import { resolveExamScope } from "../auditScope"
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

  const examPage = await prisma.examPage.findUnique({
    where: { id: examPageId },
  })

  // 模範解答画像を持たないページはマーカー補正の基準にできない。
  // ここを通すと sharp に空パス（＝データディレクトリ）を渡してしまい、
  // 例外がアップロード全体を巻き込んで1枚も保存されなくなる
  if (!examPage?.imagePath) {
    cache.set(examPageId, null)
    return null
  }

  const dataDir = getSharedFilesDirectory()
  const imagePath = path.join(dataDir, examPage.imagePath)
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
    examStudentId?: string
    examPageId: string
    overwrite?: boolean
    correctWithMarkers?: boolean
  }[]
) {
  // 配置先 ExamPage が当該試験に属することを書き込み前に検証する。
  // （id 直指定に切り替えたため、他教員のページ削除等で stale な examPageId が来ると
  //  raw な FK エラーで途中まで書き込んだ部分適用になる。ここで早期に弾く。
  //  applyStudentAnswerPlacements と同じく id 一次検証。）
  const requestedExamPageIds = [
    ...new Set(filesData.map((fileData) => fileData.examPageId)),
  ]
  const validExamPages = await prisma.examPage.findMany({
    where: { examId, id: { in: requestedExamPageIds } },
  })
  const validExamPageIds = new Set(validExamPages.map((page) => page.id))
  const staleExamPageId = requestedExamPageIds.find(
    (examPageId) => !validExamPageIds.has(examPageId)
  )
  if (staleExamPageId) {
    throw new Error(
      "配置先ページが見つかりません（他の教員がページを変更した可能性があります）。ページを再読み込みしてください。"
    )
  }

  // 受験者も当該試験のものであること。ページと受験者は別々の FK なので、
  // 片方だけ検証しても「試験Aのページに試験Bの受験者の答案」が書けてしまう。
  const requestedExamStudentIds = [
    ...new Set(
      filesData
        .map((fileData) => fileData.examStudentId)
        .filter((examStudentId): examStudentId is string => !!examStudentId)
    ),
  ]
  if (requestedExamStudentIds.length > 0) {
    const validExamStudents = await prisma.examStudent.findMany({
      where: { examId, id: { in: requestedExamStudentIds } },
    })
    if (validExamStudents.length !== requestedExamStudentIds.length) {
      throw new Error(
        "配置先の受験者が見つかりません（他の教員が受験生徒を変更した可能性があります）。再読み込みしてください。"
      )
    }
  }

  const examDir = getAnswerSheetsDirectory(examId)

  // 試験ディレクトリを作成
  await fsPromises.mkdir(examDir, { recursive: true })

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
            console.warn(`画像補正スキップ (${fileData.name}): ${result.error}`)
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
    if (!fileData.examStudentId) {
      throw new Error(`ExamStudent ID is required for file: ${fileData.name}`)
    }

    // 配置先 ExamPage は id 直指定（列＝ExamPage 実体から供給される）。
    // pageNumber からの find/create はしない（id 一次同定）。
    const existingRecord = await prisma.studentAnswerImage.findFirst({
      where: {
        examPageId: fileData.examPageId,
        examStudentId: fileData.examStudentId,
      },
    })

    const timestamp = Date.now()
    const sanitizedName = fileData.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
    const fileName = `${timestamp}_${sanitizedName}`
    const filePath = path.join(examDir, fileName)
    const relativePath = getRelativePathFromSharedFiles(filePath)

    if (existingRecord) {
      if (fileData.overwrite) {
        await fsPromises.writeFile(filePath, buffer)

        try {
          const oldFilePath = getAbsolutePathFromSharedFiles(
            existingRecord.imagePath
          )
          await fsPromises.unlink(oldFilePath)
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
      await fsPromises.writeFile(filePath, buffer)

      const answerSheet = await prisma.studentAnswerImage.create({
        data: {
          examPageId: fileData.examPageId,
          examStudentId: fileData.examStudentId,
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

  return uploadedSheets
}
