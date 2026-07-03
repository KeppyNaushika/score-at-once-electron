/**
 * ASBインポートデータ作成
 *
 * リマップ済み定義をDBに保存し、画像ファイルをコピーする
 */

import * as fs from "fs"
import * as path from "path"

import type { AnswerSheetDefinition } from "../../../../src/types/answerSheetDefinition.types"
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
  const existingNames = new Set(existing.map((definition) => definition.name))

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
  for (const tempImagePath of tempImagePaths) {
    tempImageMap.set(path.basename(tempImagePath), tempImagePath)
  }

  // ツリーを走査して imagePath を更新
  const updateImageElements = (
    imageElements?: { imagePath: string; originalName: string }[]
  ) => {
    if (!imageElements) return
    for (const imageElement of imageElements) {
      const basename = path.basename(imageElement.imagePath)
      const sourcePath = tempImageMap.get(basename)
      if (sourcePath && fs.existsSync(sourcePath)) {
        const destPath = path.join(imagesDir, basename)
        fs.copyFileSync(sourcePath, destPath)
        imageElement.imagePath = getRelativePathFromData(destPath)
      }
    }
  }

  for (const majorQuestion of definition.majorQuestions) {
    for (const subQuestion of majorQuestion.subQuestions) {
      updateImageElements(subQuestion.imageElements)
      for (const branchQuestion of subQuestion.branchQuestions) {
        updateImageElements(branchQuestion.imageElements)
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
