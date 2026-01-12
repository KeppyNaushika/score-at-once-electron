/**
 * マージインポート用の画像処理モジュール
 */

import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../../dataManager"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"

/**
 * 画像ファイルをプロジェクトディレクトリにコピー
 *
 * @param data - 展開されたアーカイブデータ
 * @param newProjectId - 新規プロジェクトID
 */
export async function copyMergeImages(
  data: ExtractedArchiveData,
  newProjectId: string
): Promise<void> {
  const dataDir = getDataDirectory()
  const projectDir = path.join(dataDir, "projects", newProjectId)

  const masterImagesDir = path.join(projectDir, "master-images")
  const answerSheetsDir = path.join(projectDir, "answer-sheets")
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
  const newProjectId = Object.values(idMappings.project)[0]

  // v1.2.0+ 形式: masterImages と studentAnswerImages が存在する場合
  if (
    data.projectData.masterImages &&
    data.projectData.masterImages.length > 0
  ) {
    await createMasterImageRecords(data, idMappings, newProjectId)
  }

  if (
    data.projectData.studentAnswerImages &&
    data.projectData.studentAnswerImages.length > 0
  ) {
    await createStudentAnswerImageRecords(data, idMappings, newProjectId)
    return
  }

  // v1.1.0以前: pageImages から変換（後方互換性）
  await createLegacyImageRecords(data, idMappings, newProjectId)
}

/**
 * MasterImageレコードの作成
 */
async function createMasterImageRecords(
  data: ExtractedArchiveData,
  idMappings: Record<string, Record<string, string>>,
  newProjectId: string
): Promise<void> {
  for (const img of data.projectData.masterImages!) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    if (!newProjectPageId) continue

    const filename = path.basename(img.imagePath)
    const newImagePath = `projects/${newProjectId}/master-images/${filename}`

    await prisma.masterImage.create({
      data: {
        id: randomUUID(),
        projectPageId: newProjectPageId,
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
  newProjectId: string
): Promise<void> {
  for (const img of data.projectData.studentAnswerImages!) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    const newStudentId = idMappings.student[img.studentId]
    if (!newProjectPageId || !newStudentId) continue

    const relativePath = img.imagePath.substring(
      img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
    )
    const newImagePath =
      `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
        /\\/g,
        "/"
      )

    await prisma.studentAnswerImage.create({
      data: {
        id: randomUUID(),
        projectPageId: newProjectPageId,
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
  newProjectId: string
): Promise<void> {
  for (const img of data.projectData.pageImages) {
    const newProjectPageId = idMappings.projectPage[img.projectPageId]
    if (!newProjectPageId) continue

    const filename = path.basename(img.imagePath)

    if (img.imageType === "MODEL_ANSWER") {
      const newImagePath = `projects/${newProjectId}/master-images/${filename}`

      await prisma.masterImage.create({
        data: {
          id: randomUUID(),
          projectPageId: newProjectPageId,
          imagePath: newImagePath,
        },
      })
    } else if (img.imageType === "STUDENT_ANSWER" && img.studentId) {
      const newStudentId = idMappings.student[img.studentId]
      if (!newStudentId) continue

      const relativePath = img.imagePath.substring(
        img.imagePath.indexOf("answer-sheets") + "answer-sheets".length + 1
      )
      const newImagePath =
        `projects/${newProjectId}/answer-sheets/${relativePath}`.replace(
          /\\/g,
          "/"
        )

      await prisma.studentAnswerImage.create({
        data: {
          id: randomUUID(),
          projectPageId: newProjectPageId,
          studentId: newStudentId,
          imagePath: newImagePath,
        },
      })
    }
  }
}
