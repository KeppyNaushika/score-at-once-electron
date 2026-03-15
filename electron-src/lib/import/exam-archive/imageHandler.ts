/**
 * 新規インポート用の画像処理モジュール
 */

import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "./archiveExtractor"
import type { IdMappings } from "./idRemapper"
import { remapId, remapIdRequired } from "./idRemapper"

/**
 * 画像ファイルを試験ディレクトリにコピー
 *
 * @param data - 展開されたアーカイブデータ
 * @param newExamId - 新規試験ID
 */
export async function copyImages(
  data: ExtractedArchiveData,
  newExamId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const examDir = path.join(dataDir, "exams", newExamId)

  // 試験ディレクトリを作成
  const masterImagesDir = path.join(examDir, "master-images")
  const answerSheetsDir = path.join(examDir, "answer-sheets")
  fs.mkdirSync(masterImagesDir, { recursive: true })
  fs.mkdirSync(answerSheetsDir, { recursive: true })

  // マスター画像をコピー
  for (const srcPath of data.masterImagePaths) {
    const filename = path.basename(srcPath)
    const destPath = path.join(masterImagesDir, filename)
    fs.copyFileSync(srcPath, destPath)
  }

  // 答案画像をコピー（生徒IDでサブディレクトリを分ける場合がある）
  for (const srcPath of data.answerSheetPaths) {
    // 相対パス構造を維持
    const relativePath = srcPath.substring(
      srcPath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const destPath = path.join(answerSheetsDir, relativePath)

    // ディレクトリを作成
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
 * @param mappings - IDマッピング
 * @param newExamId - 新規試験ID
 */
export async function createImageRecords(
  data: ExtractedArchiveData,
  mappings: IdMappings,
  newExamId: string
): Promise<void> {
  // v1.2.0+ 形式: masterImages と studentAnswerImages が存在する場合
  if (data.examData.masterImages && data.examData.masterImages.length > 0) {
    for (const img of data.examData.masterImages) {
      const newExamPageId = remapId(img.examPageId, mappings.examPage)
      if (!newExamPageId) continue

      const filename = path.basename(img.imagePath)
      const newImagePath = `exams/${newExamId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: remapIdRequired(img.id, mappings.masterImage),
          examPageId: newExamPageId,
          imagePath: newImagePath,
          pageSize: img.pageSize ?? "A4",
        },
      })
    }
  }

  if (
    data.examData.studentAnswerImages &&
    data.examData.studentAnswerImages.length > 0
  ) {
    for (const img of data.examData.studentAnswerImages) {
      const newExamPageId = remapId(img.examPageId, mappings.examPage)
      const newStudentId = remapId(img.studentId, mappings.student)
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
          id: remapIdRequired(img.id, mappings.studentAnswerImage),
          examPageId: newExamPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }

    return
  }

  // v1.1.0以前: pageImages から変換（後方互換性）
  for (const img of data.examData.pageImages) {
    const newExamPageId = remapId(img.examPageId, mappings.examPage)
    if (!newExamPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      const newImagePath = `exams/${newExamId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: remapIdRequired(img.id, mappings.pageImage),
          examPageId: newExamPageId,
          imagePath: newImagePath,
        },
      })
    } else if (img.imageType === "STUDENT_ANSWER" && img.studentId) {
      const newStudentId = remapId(img.studentId, mappings.student)
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
          id: remapIdRequired(img.id, mappings.pageImage),
          examPageId: newExamPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }
  }
}
