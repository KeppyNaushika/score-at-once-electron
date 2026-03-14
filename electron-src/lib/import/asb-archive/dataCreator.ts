/**
 * ASBインポートデータ作成
 *
 * リマップ済み定義をDBに保存し、画像ファイルをコピーする
 */

import * as fs from "fs"
import * as path from "path"

import type { AnswerSheetDefinition } from "../../../../types/answerSheetDefinition.types"
import {
  getAsbImagesDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import {
  listAsbDefinitions,
  saveAsbDefinition,
} from "../../prisma/asbDefinition"

/**
 * 名前の重複を解決するサフィックスを付与
 */
export async function resolveNameConflict(
  name: string,
  userId: string
): Promise<string> {
  const existing = await listAsbDefinitions(userId)
  const existingNames = new Set(existing.map((d) => d.name))

  if (!existingNames.has(name)) return name

  let suffix = 2
  while (existingNames.has(`${name} (${suffix})`)) {
    suffix++
  }
  return `${name} (${suffix})`
}

/**
 * 画像ファイルをインポート先にコピーし、定義内のimagePathを更新
 */
export function copyImagesAndUpdatePaths(
  definition: AnswerSheetDefinition,
  tempImagePaths: string[]
): void {
  if (tempImagePaths.length === 0) return

  const imagesDir = getAsbImagesDirectory(definition.id)
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true })
  }

  // tempイメージの basename → fullPath マップ
  const tempImageMap = new Map<string, string>()
  for (const p of tempImagePaths) {
    tempImageMap.set(path.basename(p), p)
  }

  // ツリーを走査して imagePath を更新
  const updateImageElements = (
    imageElements?: { imagePath: string; originalName: string }[]
  ) => {
    if (!imageElements) return
    for (const ie of imageElements) {
      const basename = path.basename(ie.imagePath)
      const sourcePath = tempImageMap.get(basename)
      if (sourcePath && fs.existsSync(sourcePath)) {
        const destPath = path.join(imagesDir, basename)
        fs.copyFileSync(sourcePath, destPath)
        ie.imagePath = getRelativePathFromData(destPath)
      }
    }
  }

  for (const mq of definition.majorQuestions) {
    for (const sq of mq.subQuestions) {
      updateImageElements(sq.imageElements)
      for (const bq of sq.branchQuestions) {
        updateImageElements(bq.imageElements)
      }
    }
  }
}

/**
 * インポートした定義をDBに保存
 */
export async function createImportedAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string
): Promise<void> {
  await saveAsbDefinition(definition, userId)
}
