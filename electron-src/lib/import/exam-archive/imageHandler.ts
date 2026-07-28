/**
 * 新規インポート用の画像処理モジュール
 */

import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "./archiveExtractor"
import type { ExamArchiveIdMappings } from "./idRemapper"
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
  mappings: ExamArchiveIdMappings,
  newExamId: string
): Promise<void> {
  // v1.2.0+ 形式: masterImages と studentAnswerImages が存在する場合
  if (data.examData.masterImages && data.examData.masterImages.length > 0) {
    for (const masterImage of data.examData.masterImages) {
      const newExamPageId = remapId(masterImage.examPageId, mappings.examPage)
      if (!newExamPageId) continue

      const filename = path.basename(masterImage.imagePath)
      const newImagePath = `exams/${newExamId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: remapIdRequired(masterImage.id, mappings.masterImage),
          examPageId: newExamPageId,
          imagePath: newImagePath,
          pageSize: masterImage.pageSize ?? "A4",
        },
      })
    }
  }

  if (
    data.examData.studentAnswerImages &&
    data.examData.studentAnswerImages.length > 0
  ) {
    for (const studentAnswerImage of data.examData.studentAnswerImages) {
      const newExamPageId = remapId(
        studentAnswerImage.examPageId,
        mappings.examPage
      )
      const newExamStudentId = remapId(
        studentAnswerImage.examStudentId,
        mappings.examStudent
      )
      if (!newExamPageId || !newExamStudentId) continue

      // mappings.examStudent は全行分の uuid を先に振るだけで、受験者が実際に
      // 作られたかは表さない（生徒を解決できないアーカイブ行は作られない）。
      // 存在しない親を指すと FK 違反でインポート全体が落ちるので、ここで確かめる。
      const parentExamStudent = await prisma.examStudent.findUnique({
        where: { id: newExamStudentId },
        select: { id: true },
      })
      if (!parentExamStudent) continue

      // 同一(examPageId, examStudentId)の重複チェック
      const existing = await prisma.studentAnswerImage.findFirst({
        where: {
          examPageId: newExamPageId,
          examStudentId: newExamStudentId,
        },
      })
      if (existing) continue

      const relativePath = studentAnswerImage.imagePath.substring(
        studentAnswerImage.imagePath.indexOf("answer-sheets") +
          "answer-sheets".length +
          1
      )
      const newImagePath =
        `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

      await prisma.studentAnswerImage.create({
        data: {
          id: remapIdRequired(
            studentAnswerImage.id,
            mappings.studentAnswerImage
          ),
          examPageId: newExamPageId,
          examStudentId: newExamStudentId,
          imagePath: newImagePath,
        },
      })
    }

    return
  }

  // v1.1.0以前: pageImages から変換（後方互換性）
  for (const pageImage of data.examData.pageImages) {
    const newExamPageId = remapId(pageImage.examPageId, mappings.examPage)
    if (!newExamPageId) continue

    const filename = path.basename(pageImage.imagePath)

    if (pageImage.imageType === "MODEL_ANSWER") {
      const newImagePath = `exams/${newExamId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: remapIdRequired(pageImage.id, mappings.pageImage),
          examPageId: newExamPageId,
          imagePath: newImagePath,
        },
      })
    } else if (
      pageImage.imageType === "STUDENT_ANSWER" &&
      pageImage.studentId
    ) {
      const newStudentId = remapId(pageImage.studentId, mappings.student)
      if (!newStudentId) continue

      // 旧 pageImages は生徒直結だったので、受験者へ解決する
      // （受験者に居ない生徒の答案は取り込まない）
      const examStudent = await prisma.examStudent.findUnique({
        where: {
          examId_studentId: { examId: newExamId, studentId: newStudentId },
        },
        select: { id: true },
      })
      if (!examStudent) continue

      // 同一(examPageId, examStudentId)の重複チェック
      const existing = await prisma.studentAnswerImage.findFirst({
        where: {
          examPageId: newExamPageId,
          examStudentId: examStudent.id,
        },
      })
      if (existing) continue

      const relativePath = pageImage.imagePath.substring(
        pageImage.imagePath.indexOf("answer-sheets") +
          "answer-sheets".length +
          1
      )
      const newImagePath =
        `exams/${newExamId}/answer-sheets/${relativePath}`.replace(/\\/g, "/")

      await prisma.studentAnswerImage.create({
        data: {
          id: remapIdRequired(pageImage.id, mappings.pageImage),
          examPageId: newExamPageId,
          examStudentId: examStudent.id,
          imagePath: newImagePath,
        },
      })
    }
  }
}
