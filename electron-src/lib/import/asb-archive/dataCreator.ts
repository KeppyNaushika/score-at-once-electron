/**
 * ASBインポートデータ作成
 *
 * リマップ済み定義をDBに保存し、画像ファイルをコピーする
 */

import * as fs from "fs"
import * as path from "path"

import type { AnswerSheetDefinition } from "../../../../src/types/answerSheetDefinition.types"
import type {
  ArchiveAsbTag,
  AsbDefinitionTagRef,
} from "../../../../src/types/asbArchive.types"
import {
  getAsbImagesDirectory,
  getRelativePathFromData,
} from "../../dataManager"
import {
  listAsbDefinitions,
  saveAsbDefinition,
} from "../../prisma/asbDefinition"
import prisma from "../../prisma/client"

/**
 * 名前の重複を解決するサフィックスを付与
 */
export async function resolveNameConflict(name: string): Promise<string> {
  const existing = await listAsbDefinitions()
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
 * インポートした定義をDBに保存し、タグを復元して紐付ける。
 *
 * タグは UUID一次照合 → タグ名で upsert（name は unique）で解決する。
 * saveAsbDefinition が独自トランザクションを持つためタグ紐付けは別トランザクションになり、
 * 定義本体はこの時点で既にコミット済み。したがってタグ紐付けの失敗は「取り込み失敗」に
 * せず（=握りつぶさず警告として返し）、再インポートで重複定義が生じるのを防ぐ。
 * タグは概要ページのタグ設定UIから後から復旧できる。
 *
 * @returns タグ紐付けに失敗した場合の警告メッセージ（成功時は空配列）
 */
export async function createImportedAsbDefinition(
  definition: AnswerSheetDefinition,
  userId: string,
  tagsData: ArchiveAsbTag[],
  asbDefinitionTags: AsbDefinitionTagRef[]
): Promise<string[]> {
  await saveAsbDefinition(definition, userId)

  if (tagsData.length === 0 || asbDefinitionTags.length === 0) return []

  try {
    await prisma.$transaction(async (tx) => {
      // アーカイブ内 tagId → 実 tagId のマップを作る
      const tagIdMap = new Map<string, string>()
      for (const archiveTag of tagsData) {
        const existingTag = await tx.tag.findUnique({
          where: { id: archiveTag.id },
        })
        if (existingTag) {
          tagIdMap.set(archiveTag.id, existingTag.id)
          continue
        }
        const tag = await tx.tag.upsert({
          where: { name: archiveTag.name },
          create: {
            name: archiveTag.name,
            order: archiveTag.order,
            color: archiveTag.color,
          },
          update: {},
        })
        tagIdMap.set(archiveTag.id, tag.id)
      }

      // 定義へのタグ参照を復元（冪等: 既存があればスキップ）
      for (const definitionTagRef of asbDefinitionTags) {
        const realTagId = tagIdMap.get(definitionTagRef.tagId)
        if (!realTagId) continue
        const existingDefinitionTag = await tx.asbDefinitionTag.findUnique({
          where: {
            asbDefinitionId_tagId: {
              asbDefinitionId: definition.id,
              tagId: realTagId,
            },
          },
        })
        if (!existingDefinitionTag) {
          await tx.asbDefinitionTag.create({
            data: { asbDefinitionId: definition.id, tagId: realTagId },
          })
        }
      }
    })
  } catch (error) {
    console.error("Failed to link tags on ASB import:", error)
    return [
      "タグの復元に失敗しました。定義は取り込まれましたが、タグは概要ページから手動で設定してください。",
    ]
  }

  return []
}
