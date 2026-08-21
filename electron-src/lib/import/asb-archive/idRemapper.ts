/**
 * ASB定義のID再マッピング
 *
 * インポート時に全IDを新UUIDに置換して競合を防ぐ
 */

import * as crypto from "crypto"

import type {
  AnswerSheetDefinition,
  ManuscriptPaper,
} from "../../../../src/types/answerSheetDefinition.types"
import type { AsbIdMappings } from "../../../../src/types/asbArchive.types"

/**
 * 定義ツリー内の全IDに対するマッピングを生成
 */
export function generateAsbIdMappings(
  definition: AnswerSheetDefinition
): AsbIdMappings {
  const mappings: AsbIdMappings = {
    definition: { [definition.id]: crypto.randomUUID() },
    headerField: {},
    majorQuestion: {},
    subQuestion: {},
    branchQuestion: {},
    textElement: {},
    imageElement: {},
    charGuide: {},
    omrConfig: {},
    manuscriptPaper: {},
  }

  for (const headerField of definition.settings.headerFields) {
    mappings.headerField[headerField.id] = crypto.randomUUID()
  }

  for (const majorQuestion of definition.majorQuestions) {
    mappings.majorQuestion[majorQuestion.id] = crypto.randomUUID()

    for (const subQuestion of majorQuestion.subQuestions) {
      mappings.subQuestion[subQuestion.id] = crypto.randomUUID()

      for (const textElement of subQuestion.textElements) {
        mappings.textElement[textElement.id] = crypto.randomUUID()
      }
      if (subQuestion.imageElements) {
        for (const imageElement of subQuestion.imageElements) {
          mappings.imageElement[imageElement.id] = crypto.randomUUID()
        }
      }
      if (subQuestion.manuscriptPaper) {
        mappings.manuscriptPaper[subQuestion.manuscriptPaper.id] =
          crypto.randomUUID()
        for (const charGuide of subQuestion.manuscriptPaper.charGuides) {
          mappings.charGuide[charGuide.id] = crypto.randomUUID()
        }
      }
      if (subQuestion.omrConfig) {
        mappings.omrConfig[subQuestion.id] = crypto.randomUUID()
      }

      for (const branchQuestion of subQuestion.branchQuestions) {
        mappings.branchQuestion[branchQuestion.id] = crypto.randomUUID()

        for (const textElement of branchQuestion.textElements) {
          mappings.textElement[textElement.id] = crypto.randomUUID()
        }
        if (branchQuestion.imageElements) {
          for (const imageElement of branchQuestion.imageElements) {
            mappings.imageElement[imageElement.id] = crypto.randomUUID()
          }
        }
        if (branchQuestion.manuscriptPaper) {
          mappings.manuscriptPaper[branchQuestion.manuscriptPaper.id] =
            crypto.randomUUID()
          for (const charGuide of branchQuestion.manuscriptPaper.charGuides) {
            mappings.charGuide[charGuide.id] = crypto.randomUUID()
          }
        }
        if (branchQuestion.omrConfig) {
          mappings.omrConfig[branchQuestion.id] = crypto.randomUUID()
        }
      }
    }
  }

  return mappings
}

/** 原稿用紙と、その下の文字位置マーカーの id を差し替える */
function remapManuscriptPaperIds(
  manuscriptPaper: ManuscriptPaper,
  mappings: AsbIdMappings
): void {
  manuscriptPaper.id =
    mappings.manuscriptPaper[manuscriptPaper.id] ?? manuscriptPaper.id
  for (const charGuide of manuscriptPaper.charGuides) {
    charGuide.id = mappings.charGuide[charGuide.id] ?? charGuide.id
  }
}

/**
 * 定義のdeep cloneを作成し、全IDを新UUIDに置換
 */
export function remapDefinitionIds(
  definition: AnswerSheetDefinition,
  mappings: AsbIdMappings
): AnswerSheetDefinition {
  const cloned: AnswerSheetDefinition = JSON.parse(JSON.stringify(definition))

  cloned.id = mappings.definition[definition.id]

  for (const headerField of cloned.settings.headerFields) {
    headerField.id = mappings.headerField[headerField.id] ?? headerField.id
  }

  for (const majorQuestion of cloned.majorQuestions) {
    majorQuestion.id =
      mappings.majorQuestion[majorQuestion.id] ?? majorQuestion.id

    for (const subQuestion of majorQuestion.subQuestions) {
      subQuestion.id = mappings.subQuestion[subQuestion.id] ?? subQuestion.id

      for (const textElement of subQuestion.textElements) {
        textElement.id = mappings.textElement[textElement.id] ?? textElement.id
      }
      if (subQuestion.imageElements) {
        for (const imageElement of subQuestion.imageElements) {
          imageElement.id =
            mappings.imageElement[imageElement.id] ?? imageElement.id
        }
      }
      if (subQuestion.manuscriptPaper) {
        remapManuscriptPaperIds(subQuestion.manuscriptPaper, mappings)
      }

      for (const branchQuestion of subQuestion.branchQuestions) {
        branchQuestion.id =
          mappings.branchQuestion[branchQuestion.id] ?? branchQuestion.id

        for (const textElement of branchQuestion.textElements) {
          textElement.id =
            mappings.textElement[textElement.id] ?? textElement.id
        }
        if (branchQuestion.imageElements) {
          for (const imageElement of branchQuestion.imageElements) {
            imageElement.id =
              mappings.imageElement[imageElement.id] ?? imageElement.id
          }
        }
        if (branchQuestion.manuscriptPaper) {
          remapManuscriptPaperIds(branchQuestion.manuscriptPaper, mappings)
        }
      }
    }
  }

  // createdAt/updatedAt をリセット
  delete cloned.createdAt
  delete cloned.updatedAt

  return cloned
}
