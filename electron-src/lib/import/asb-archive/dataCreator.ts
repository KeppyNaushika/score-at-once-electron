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
  getRelativePathFromSharedFiles,
} from "../../dataManager"
import { replaceAsbDefinition } from "../../prisma/asbDefinitionReplace"
import prisma from "../../prisma/client"
import { resolveTags } from "../coursework-archive/idRemapper"
import { createImportValuePolicy } from "../merge/importValuePolicy"
import { isAsbImagePath } from "../unified-archive/archiveValueGuards"

/**
 * 画像ファイルをインポート先にコピーし、定義内のimagePathを更新する。
 *
 * 写せなかった画像（アーカイブに同梱されていない）はアーカイブのパスのまま残るので、
 * 最後に全ての画像のパスが解答用紙の画像の置き場の形（`archiveValueGuards.ts`）であることを
 * 確かめ、外れたものがあれば取り込まない（そのパスで差し替え・削除・複製が動くため）
 */
export function copyImagesAndUpdatePaths(
  definition: AnswerSheetDefinition,
  tempImagePaths: string[],
  options: {
    /**
     * 確かめに失敗したとき、定義の画像のフォルダを消すか。まだ無い解答用紙のときだけ
     * true（写した画像はそのフォルダにだけある）。既にある解答用紙のフォルダには、
     * 取り込み先の画像が入っている
     */
    removeImagesOnFailure: boolean
  }
): void {
  if (tempImagePaths.length > 0) copyImages(definition, tempImagePaths)
  try {
    assertAsbImagePaths(definition)
  } catch (error) {
    if (options.removeImagesOnFailure) {
      // DB へ書く前なので、写した画像を消す
      fs.rmSync(path.dirname(getAsbImagesDirectory(definition.id)), {
        recursive: true,
        force: true,
      })
    }
    throw error
  }
}

/** 定義の全ての画像要素 */
const imageElementsOf = (definition: AnswerSheetDefinition) =>
  definition.majorQuestions.flatMap((majorQuestion) =>
    majorQuestion.subQuestions.flatMap((subQuestion) => [
      ...(subQuestion.imageElements ?? []),
      ...subQuestion.branchQuestions.flatMap(
        (branchQuestion) => branchQuestion.imageElements ?? []
      ),
    ])
  )

/** 画像のパスが空か、解答用紙の画像の置き場の形でなければ投げる */
function assertAsbImagePaths(definition: AnswerSheetDefinition): void {
  const unsafeCount = imageElementsOf(definition).filter(
    (imageElement) =>
      imageElement.imagePath !== "" && !isAsbImagePath(imageElement.imagePath)
  ).length
  if (unsafeCount > 0) {
    throw new Error(
      `アーカイブに、画像の場所として扱えない値が ${unsafeCount}件あるため取り込めません`
    )
  }
}

function copyImages(
  definition: AnswerSheetDefinition,
  tempImagePaths: string[]
): void {
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
        imageElement.imagePath = getRelativePathFromSharedFiles(destPath)
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
 * タグは id 一次照合 → タグ名（name は unique）で解決し、無ければアーカイブの id で作る。
 * replaceAsbDefinition が独自トランザクションを持つためタグ紐付けは別トランザクションになり、
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
  await replaceAsbDefinition(definition, userId)

  if (tagsData.length === 0 || asbDefinitionTags.length === 0) return []

  try {
    await prisma.$transaction(async (tx) => {
      // アーカイブ内 tagId → 実 tagId（id 一次 → タグ名。.coursework と同じ決まり）
      const tagIdMap = await resolveTags(
        tx,
        tagsData,
        createImportValuePolicy("merge")
      )

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
