/**
 * ASB定義エクスポート用データ収集
 */

import type { AnswerSheetDefinition } from "../../../../src/types/answerSheetDefinition.types"
import type { AsbArchiveDataCounts } from "../../../../src/types/asbArchive.types"

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
  let charGuides = 0
  let subQuestions = 0
  let branchQuestions = 0
  let omrConfigs = 0

  for (const majorQuestion of definition.majorQuestions) {
    for (const subQuestion of majorQuestion.subQuestions) {
      subQuestions++
      textElements += subQuestion.textElements.length
      charGuides += subQuestion.manuscriptPaper?.charGuides?.length ?? 0
      if (subQuestion.imageElements) {
        imageElements += subQuestion.imageElements.length
        for (const imageElement of subQuestion.imageElements) {
          if (imageElement.imagePath) imagePaths.push(imageElement.imagePath)
        }
      }
      if (subQuestion.omrConfig) omrConfigs++

      for (const branchQuestion of subQuestion.branchQuestions) {
        branchQuestions++
        textElements += branchQuestion.textElements.length
        if (branchQuestion.imageElements) {
          imageElements += branchQuestion.imageElements.length
          for (const imageElement of branchQuestion.imageElements) {
            if (imageElement.imagePath) imagePaths.push(imageElement.imagePath)
          }
        }
        if (branchQuestion.omrConfig) omrConfigs++
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
      charGuides,
      omrConfigs,
      images: imagePaths.length,
    },
    imagePaths,
  }
}
