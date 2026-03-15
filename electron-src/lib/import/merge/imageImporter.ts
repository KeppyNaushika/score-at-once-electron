/**
 * 画像インポート処理
 */

import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../../dataManager"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { IdMappings, PrismaTransaction } from "./types"

/**
 * 画像ファイルを試験ディレクトリにコピー
 * 既存のファイルがある場合はスキップ（試験ID一致時のマージ対応）
 */
export async function copyImportImages(
  data: ExtractedArchiveData,
  newExamId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const examDir = path.join(dataDir, "exams", newExamId)

  const masterImagesDir = path.join(examDir, "master-images")
  const answerSheetsDir = path.join(examDir, "answer-sheets")
  fs.mkdirSync(masterImagesDir, { recursive: true })
  fs.mkdirSync(answerSheetsDir, { recursive: true })

  for (const srcPath of data.masterImagePaths) {
    const filename = path.basename(srcPath)
    const destPath = path.join(masterImagesDir, filename)
    // 既存ファイルがない場合のみコピー
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath)
    }
  }

  for (const srcPath of data.answerSheetPaths) {
    const relativePath = srcPath.substring(
      srcPath.lastIndexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const destPath = path.join(answerSheetsDir, relativePath)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    // 既存ファイルがない場合のみコピー
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * 画像レコードを作成（既存レコードがある場合はスキップ）
 * トランザクション内で実行される。
 */
export async function createImportImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  tx: PrismaTransaction
): Promise<void> {
  const newExamId = idMappings.exam[data.examData.exam.id]

  // MasterImage レコードの作成
  if (data.examData.masterImages && data.examData.masterImages.length > 0) {
    await createMasterImageRecords(data, idMappings, newExamId, tx)
  }

  // StudentAnswerImage レコードの作成
  if (
    data.examData.studentAnswerImages &&
    data.examData.studentAnswerImages.length > 0
  ) {
    await createStudentAnswerImageRecords(data, idMappings, newExamId, tx)
    return
  }

  // v1.1.0以前との後方互換性（pageImagesを使用）
  await createLegacyImageRecords(data, idMappings, newExamId, tx)
}

/**
 * MasterImageレコードの作成
 */
async function createMasterImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const img of data.examData.masterImages!) {
    const newExamPageId = idMappings.examPage[img.examPageId]
    if (!newExamPageId) continue

    // 既存のMasterImageレコードをチェック
    const existing = await tx.masterImage.findFirst({
      where: { examPageId: newExamPageId },
    })
    if (existing) continue

    const filename = path.basename(img.imagePath)
    const newImagePath = `exams/${newExamId}/master-images/${filename}`

    const existingById = await tx.masterImage.findUnique({
      where: { id: img.id },
    })
    if (!existingById) {
      await tx.masterImage.create({
        data: {
          id: img.id,
          examPageId: newExamPageId,
          imagePath: newImagePath,
          pageSize: img.pageSize ?? "A4",
        },
      })
    }
  }
}

/**
 * StudentAnswerImageレコードの作成
 */
async function createStudentAnswerImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const img of data.examData.studentAnswerImages!) {
    const newExamPageId = idMappings.examPage[img.examPageId]
    const newStudentId = idMappings.student[img.studentId]
    if (!newExamPageId || !newStudentId) continue

    // 既存のStudentAnswerImageレコードをチェック
    const existing = await tx.studentAnswerImage.findFirst({
      where: {
        examPageId: newExamPageId,
        studentId: newStudentId,
      },
    })
    if (existing) continue

    const relativePath = img.imagePath.substring(
      img.imagePath.lastIndexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const newImagePath =
      `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

    const existingById = await tx.studentAnswerImage.findUnique({
      where: { id: img.id },
    })
    if (!existingById) {
      await tx.studentAnswerImage.create({
        data: {
          id: img.id,
          examPageId: newExamPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }
  }
}

/**
 * v1.1.0以前との後方互換性: pageImagesからレコード作成
 */
async function createLegacyImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const img of data.examData.pageImages) {
    const newExamPageId = idMappings.examPage[img.examPageId]
    if (!newExamPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      // 既存のMasterImageレコードをチェック
      const existingMaster = await tx.masterImage.findFirst({
        where: { examPageId: newExamPageId },
      })
      if (existingMaster) continue

      const newImagePath = `exams/${newExamId}/master-images/${filename}`

      const existingById = await tx.masterImage.findUnique({
        where: { id: img.id },
      })
      if (!existingById) {
        await tx.masterImage.create({
          data: {
            id: img.id,
            examPageId: newExamPageId,
            imagePath: newImagePath,
          },
        })
      }
    } else if (img.imageType === "STUDENT_ANSWER" && img.studentId) {
      const newStudentId = idMappings.student[img.studentId]
      if (!newStudentId) continue

      // 既存のStudentAnswerImageレコードをチェック
      const existingAnswer = await tx.studentAnswerImage.findFirst({
        where: {
          examPageId: newExamPageId,
          studentId: newStudentId,
        },
      })
      if (existingAnswer) continue

      const relativePath = img.imagePath.substring(
        img.imagePath.lastIndexOf("answer-sheets") + "answer-sheets".length + 1
      )
      const newImagePath =
        `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

      const existingById = await tx.studentAnswerImage.findUnique({
        where: { id: img.id },
      })
      if (!existingById) {
        await tx.studentAnswerImage.create({
          data: {
            id: img.id,
            examPageId: newExamPageId,
            studentId: newStudentId,
            imagePath: newImagePath,
          },
        })
      }
    }
  }
}
