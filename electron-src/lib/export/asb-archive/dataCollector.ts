/**
 * ASB定義エクスポート用データ収集
 */

import type { AnswerSheetDefinition } from "../../../../types/answerSheetDefinition.types"
import type { AsbArchiveDataCounts } from "../../../../types/asbArchive.types"

export interface CollectedAsbData {
  definition: AnswerSheetDefinition
  counts: AsbArchiveDataCounts
  imagePaths: string[]
}

/**
 * 定義ツリーを走査して画像パスとカウント情報を収集
 */
export function collectAsbData(
  definition: AnswerSheetDefinition
): CollectedAsbData {
  const imagePaths: string[] = []
  let textElements = 0
  let imageElements = 0
  let subQuestions = 0
  let branchQuestions = 0
  let omrConfigs = 0

  for (const mq of definition.majorQuestions) {
    for (const sq of mq.subQuestions) {
      subQuestions++
      textElements += sq.textElements.length
      if (sq.imageElements) {
        imageElements += sq.imageElements.length
        for (const ie of sq.imageElements) {
          if (ie.imagePath) imagePaths.push(ie.imagePath)
        }
      }
      if (sq.omrConfig) omrConfigs++

      for (const bq of sq.branchQuestions) {
        branchQuestions++
        textElements += bq.textElements.length
        if (bq.imageElements) {
          imageElements += bq.imageElements.length
          for (const ie of bq.imageElements) {
            if (ie.imagePath) imagePaths.push(ie.imagePath)
          }
        }
        if (bq.omrConfig) omrConfigs++
      }
    }
  }

  return {
    definition,
    counts: {
      headerFields: definition.settings.headerFields.length,
      majorQuestions: definition.majorQuestions.length,
      subQuestions,
      branchQuestions,
      textElements,
      imageElements,
      omrConfigs,
      images: imagePaths.length,
    },
    imagePaths,
  }
}
