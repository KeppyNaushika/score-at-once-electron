/**
 * マージインポート用の画像処理モジュール
 */

import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"

/**
 * 画像ファイルを試験ディレクトリにコピー
 *
 * @param data - 展開されたアーカイブデータ
 * @param newExamId - 新規試験ID
 */
export async function copyMergeImages(
  data: ExtractedArchiveData,
  newExamId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const examDir = path.join(dataDir, "exams", newExamId)

  const masterImagesDir = path.join(examDir, "master-images")
  const answerSheetsDir = path.join(examDir, "answer-sheets")
  fs.mkdirSync(masterImagesDir, { recursive: true })
  fs.mkdirSync(answerSheetsDir, { recursive: true })

  // マスター画像
  for (const srcPath of data.masterImagePaths) {
    const filename = path.basename(srcPath)
    const destPath = path.join(masterImagesDir, filename)
    fs.copyFileSync(srcPath, destPath)
  }

  // 答案画像
  for (const srcPath of data.answerSheetPaths) {
    const relativePath = srcPath.substring(
      srcPath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const destPath = path.join(answerSheetsDir, relativePath)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.copyFileSync(srcPath, destPath)
  }
}

/**
 * 画像レコードを作成（MasterImage / StudentAnswerImage）
 *
 * - v1.2.0+: masterImages と studentAnswerImages を使用
 * - v1.1.0以前: pageImages から変換（後方互換性）
 *
 * @param data - 展開されたアーカイブデータ
 * @param idMappings - IDマッピング
 */
export async function createMergeImageRecords(
  data: ExtractedArchiveData,
  idMappings: Record<string, Record<string, string>>
): Promise<void> {
  const newExamId = Object.values(idMappings.exam)[0]

  // v1.2.0+ 形式: masterImages と studentAnswerImages が存在する場合
  if (data.examData.masterImages && data.examData.masterImages.length > 0) {
    await createMasterImageRecords(data, idMappings, newExamId)
  }

  if (
    data.examData.studentAnswerImages &&
    data.examData.studentAnswerImages.length > 0
  ) {
    await createStudentAnswerImageRecords(data, idMappings, newExamId)
    return
  }

  // v1.1.0以前: pageImages から変換（後方互換性）
  await createLegacyImageRecords(data, idMappings, newExamId)
}

/**
 * MasterImageレコードの作成
 */
async function createMasterImageRecords(
  data: ExtractedArchiveData,
  idMappings: Record<string, Record<string, string>>,
  newExamId: string
): Promise<void> {
  for (const img of data.examData.masterImages!) {
    const newExamPageId = idMappings.examPage[img.examPageId]
    if (!newExamPageId) continue

    const filename = path.basename(img.imagePath)
    const newImagePath = `exams/${newExamId}/master-images/${filename}`

    await prisma.masterImage.create({
      data: {
        id: randomUUID(),
        examPageId: newExamPageId,
        imagePath: newImagePath,
      },
    })
  }
}

/**
 * StudentAnswerImageレコードの作成
 */
async function createStudentAnswerImageRecords(
  data: ExtractedArchiveData,
  idMappings: Record<string, Record<string, string>>,
  newExamId: string
): Promise<void> {
  for (const img of data.examData.studentAnswerImages!) {
    const newExamPageId = idMappings.examPage[img.examPageId]
    const newStudentId = idMappings.student[img.studentId]
    if (!newExamPageId || !newStudentId) continue

    // 同一(examPageId, studentId)の重複チェック
    const existing = await prisma.studentAnswerImage.findFirst({
      where: {
        examPageId: newExamPageId,
        studentId: newStudentId,
      },
    })
    if (existing) continue

    const relativePath = img.imagePath.substring(
      img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const newImagePath =
      `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

    await prisma.studentAnswerImage.create({
      data: {
        id: randomUUID(),
        examPageId: newExamPageId,
        studentId: newStudentId,
        imagePath: newImagePath,
      },
    })
  }
}

/**
 * v1.1.0以前: pageImagesからレコード作成（後方互換性）
 */
async function createLegacyImageRecords(
  data: ExtractedArchiveData,
  idMappings: Record<string, Record<string, string>>,
  newExamId: string
): Promise<void> {
  for (const img of data.examData.pageImages) {
    const newExamPageId = idMappings.examPage[img.examPageId]
    if (!newExamPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      const newImagePath = `exams/${newExamId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: randomUUID(),
          examPageId: newExamPageId,
          imagePath: newImagePath,
        },
      })
    } else if (img.imageType === "STUDENT_ANSWER" && img.studentId) {
      const newStudentId = idMappings.student[img.studentId]
      if (!newStudentId) continue

      // 同一(examPageId, studentId)の重複チェック
      const existing = await prisma.studentAnswerImage.findFirst({
        where: {
          examPageId: newExamPageId,
          studentId: newStudentId,
        },
      })
      if (existing) continue

      const relativePath = img.imagePath.substring(
        img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
      )
      const newImagePath =
        `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

      await prisma.studentAnswerImage.create({
        data: {
          id: randomUUID(),
          examPageId: newExamPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }
  }
}
