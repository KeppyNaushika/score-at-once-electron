/**
 * ASB定義のID再マッピング
 *
 * インポート時に全IDを新UUIDに置換して競合を防ぐ
 */

import { randomUUID } from "crypto"

import type { AnswerSheetDefinition } from "../../../../src/types/answerSheetDefinition.types"
import type { AsbIdMappings } from "../../../../src/types/asbArchive.types"

/**
 * 定義ツリー内の全IDに対するマッピングを生成
 */
export function generateAsbIdMappings(
  definition: AnswerSheetDefinition
): AsbIdMappings {
  const mappings: AsbIdMappings = {
    definition: { [definition.id]: randomUUID() },
    headerField: {},
    majorQuestion: {},
    subQuestion: {},
    branchQuestion: {},
    textElement: {},
    imageElement: {},
    charGuide: {},
    omrConfig: {},
  }

  for (const headerField of definition.settings.headerFields) {
    mappings.headerField[headerField.id] = randomUUID()
  }

  for (const majorQuestion of definition.majorQuestions) {
    mappings.majorQuestion[majorQuestion.id] = randomUUID()

    for (const subQuestion of majorQuestion.subQuestions) {
      mappings.subQuestion[subQuestion.id] = randomUUID()

      for (const textElement of subQuestion.textElements) {
        mappings.textElement[textElement.id] = randomUUID()
      }
      if (subQuestion.imageElements) {
        for (const imageElement of subQuestion.imageElements) {
          mappings.imageElement[imageElement.id] = randomUUID()
        }
      }
      if (subQuestion.manuscriptPaper?.charGuides) {
        for (const charGuide of subQuestion.manuscriptPaper.charGuides) {
          mappings.charGuide[charGuide.id] = randomUUID()
        }
      }
      if (subQuestion.omrConfig) {
        mappings.omrConfig[subQuestion.id] = randomUUID()
      }

      for (const branchQuestion of subQuestion.branchQuestions) {
        mappings.branchQuestion[branchQuestion.id] = randomUUID()

        for (const textElement of branchQuestion.textElements) {
          mappings.textElement[textElement.id] = randomUUID()
        }
        if (branchQuestion.imageElements) {
          for (const imageElement of branchQuestion.imageElements) {
            mappings.imageElement[imageElement.id] = randomUUID()
          }
        }
        if (branchQuestion.omrConfig) {
          mappings.omrConfig[branchQuestion.id] = randomUUID()
        }
      }
    }
  }

  return mappings
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
      if (subQuestion.manuscriptPaper?.charGuides) {
        for (const charGuide of subQuestion.manuscriptPaper.charGuides) {
          charGuide.id = mappings.charGuide[charGuide.id] ?? charGuide.id
        }
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
      }
    }
  }

  // createdAt/updatedAt をリセット
  delete cloned.createdAt
  delete cloned.updatedAt

  return cloned
}
