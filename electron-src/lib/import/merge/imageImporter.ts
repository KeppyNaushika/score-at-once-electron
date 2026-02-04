/**
 * 画像インポート処理
 */

import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../../dataManager"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"
import type { IdMappings, PrismaTransaction } from "./types"

/**
 * 画像ファイルをプロジェクトディレクトリにコピー
 * 既存のファイルがある場合はスキップ（プロジェクトID一致時のマージ対応）
 */
export async function copyImportImages(
  data: ExtractedArchiveData,
  newProjectId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const projectDir = path.join(dataDir, "projects", newProjectId)

  const masterImagesDir = path.join(projectDir, "master-images")
  const answerSheetsDir = path.join(projectDir, "answer-sheets")
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
  const newProjectId = idMappings.project[data.projectData.project.id]

  // MasterImage レコードの作成
  if (
    data.projectData.masterImages &&
    data.projectData.masterImages.length > 0
  ) {
    await createMasterImageRecords(data, idMappings, newProjectId, tx)
  }

  // StudentAnswerImage レコードの作成
  if (
    data.projectData.studentAnswerImages &&
    data.projectData.studentAnswerImages.length > 0
  ) {
    await createStudentAnswerImageRecords(data, idMappings, newProjectId, tx)
    return
  }

  // v1.1.0以前との後方互換性（pageImagesを使用）
  await createLegacyImageRecords(data, idMappings, newProjectId, tx)
}

/**
 * MasterImageレコードの作成
 */
async function createMasterImageRecords(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  newProjectId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const img of data.projectData.masterImages!) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    if (!newProjectPageId) continue

    // 既存のMasterImageレコードをチェック
    const existing = await tx.masterImage.findFirst({
      where: { projectPageId: newProjectPageId },
    })
    if (existing) continue

    const filename = path.basename(img.imagePath)
    const newImagePath = `projects/${newProjectId}/master-images/${filename}`

    const existingById = await tx.masterImage.findUnique({
      where: { id: img.id },
    })
    if (!existingById) {
      await tx.masterImage.create({
        data: {
          id: img.id,
          projectPageId: newProjectPageId,
          imagePath: newImagePath,
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
  newProjectId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const img of data.projectData.studentAnswerImages!) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    const newStudentId = idMappings.student[img.studentId]
    if (!newProjectPageId || !newStudentId) continue

    // 既存のStudentAnswerImageレコードをチェック
    const existing = await tx.studentAnswerImage.findFirst({
      where: {
        projectPageId: newProjectPageId,
        studentId: newStudentId,
      },
    })
    if (existing) continue

    const relativePath = img.imagePath.substring(
      img.imagePath.lastIndexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const newImagePath =
      `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
        /\\/g,
        "/"
      )

    const existingById = await tx.studentAnswerImage.findUnique({
      where: { id: img.id },
    })
    if (!existingById) {
      await tx.studentAnswerImage.create({
        data: {
          id: img.id,
          projectPageId: newProjectPageId,
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
  newProjectId: string,
  tx: PrismaTransaction
): Promise<void> {
  for (const img of data.projectData.pageImages) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    if (!newProjectPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      // 既存のMasterImageレコードをチェック
      const existingMaster = await tx.masterImage.findFirst({
        where: { projectPageId: newProjectPageId },
      })
      if (existingMaster) continue

      const newImagePath = `projects/${newProjectId}/master-images/${filename}`

      const existingById = await tx.masterImage.findUnique({
        where: { id: img.id },
      })
      if (!existingById) {
        await tx.masterImage.create({
          data: {
            id: img.id,
            projectPageId: newProjectPageId,
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
          projectPageId: newProjectPageId,
          studentId: newStudentId,
        },
      })
      if (existingAnswer) continue

      const relativePath = img.imagePath.substring(
        img.imagePath.lastIndexOf("answer-sheets") + "answer-sheets".length + 1
      )
      const newImagePath =
        `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
          /\\/g,
          "/"
        )

      const existingById = await tx.studentAnswerImage.findUnique({
        where: { id: img.id },
      })
      if (!existingById) {
        await tx.studentAnswerImage.create({
          data: {
            id: img.id,
            projectPageId: newProjectPageId,
            studentId: newStudentId,
            imagePath: newImagePath,
          },
        })
      }
    }
  }
}
