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

  // 模範解答画像は ExamPage 自身が持つため、ページ作成時（importExamCore）に入っている

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
 * StudentAnswerImageレコードの作成
 */
async function createStudentAnswerImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  newExamId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const studentAnswerImage of data.examData.studentAnswerImages!) {
    const newExamPageId = idMappings.examPage[studentAnswerImage.examPageId]
    const newExamStudentId =
      idMappings.examStudent[studentAnswerImage.examStudentId]
    if (!newExamPageId || !newExamStudentId) continue

    // 既存のStudentAnswerImageレコードをチェック
    const existing = await tx.studentAnswerImage.findFirst({
      where: {
        examPageId: newExamPageId,
        examStudentId: newExamStudentId,
      },
    })
    if (existing) continue

    const relativePath = studentAnswerImage.imagePath.substring(
      studentAnswerImage.imagePath.lastIndexOf("answer-sheets") +
        "answer-sheets".length +
        1
    )
    const newImagePath =
      `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

    const existingById = await tx.studentAnswerImage.findUnique({
      where: { id: studentAnswerImage.id },
    })
    if (!existingById) {
      await tx.studentAnswerImage.create({
        data: {
          id: studentAnswerImage.id,
          examPageId: newExamPageId,
          examStudentId: newExamStudentId,
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
  for (const pageImage of data.examData.pageImages) {
    const newExamPageId = idMappings.examPage[pageImage.examPageId]
    if (!newExamPageId) continue

    // 模範解答（MODEL_ANSWER）はページが持つので、ここでは答案だけを見る。
    // v1.1.0 以前の pageImages は変換器が masterImages を経て examPages へ畳んでいる
    if (pageImage.imageType === "STUDENT_ANSWER" && pageImage.studentId) {
      const newStudentId = idMappings.student[pageImage.studentId]
      if (!newStudentId) continue

      // 旧 pageImages は生徒直結だったので、受験者へ解決する
      const examStudent = await tx.examStudent.findUnique({
        where: {
          examId_studentId: { examId: newExamId, studentId: newStudentId },
        },
      })
      if (!examStudent) continue

      // 既存のStudentAnswerImageレコードをチェック
      const existingAnswer = await tx.studentAnswerImage.findFirst({
        where: {
          examPageId: newExamPageId,
          examStudentId: examStudent.id,
        },
      })
      if (existingAnswer) continue

      const relativePath = pageImage.imagePath.substring(
        pageImage.imagePath.lastIndexOf("answer-sheets") +
          "answer-sheets".length +
          1
      )
      const newImagePath =
        `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

      const existingById = await tx.studentAnswerImage.findUnique({
        where: { id: pageImage.id },
      })
      if (!existingById) {
        await tx.studentAnswerImage.create({
          data: {
            id: pageImage.id,
            examPageId: newExamPageId,
            examStudentId: examStudent.id,
            imagePath: newImagePath,
          },
        })
      }
    }
  }
}
