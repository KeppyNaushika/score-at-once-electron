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
    omrConfig: {},
  }

  for (const hf of definition.settings.headerFields) {
    mappings.headerField[hf.id] = randomUUID()
  }

  for (const mq of definition.majorQuestions) {
    mappings.majorQuestion[mq.id] = randomUUID()

    for (const sq of mq.subQuestions) {
      mappings.subQuestion[sq.id] = randomUUID()

      for (const te of sq.textElements) {
        mappings.textElement[te.id] = randomUUID()
      }
      if (sq.imageElements) {
        for (const ie of sq.imageElements) {
          mappings.imageElement[ie.id] = randomUUID()
        }
      }
      if (sq.omrConfig) {
        mappings.omrConfig[sq.id] = randomUUID()
      }

      for (const bq of sq.branchQuestions) {
        mappings.branchQuestion[bq.id] = randomUUID()

        for (const te of bq.textElements) {
          mappings.textElement[te.id] = randomUUID()
        }
        if (bq.imageElements) {
          for (const ie of bq.imageElements) {
            mappings.imageElement[ie.id] = randomUUID()
          }
        }
        if (bq.omrConfig) {
          mappings.omrConfig[bq.id] = randomUUID()
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

  for (const hf of cloned.settings.headerFields) {
    hf.id = mappings.headerField[hf.id] ?? hf.id
  }

  for (const mq of cloned.majorQuestions) {
    mq.id = mappings.majorQuestion[mq.id] ?? mq.id

    for (const sq of mq.subQuestions) {
      sq.id = mappings.subQuestion[sq.id] ?? sq.id

      for (const te of sq.textElements) {
        te.id = mappings.textElement[te.id] ?? te.id
      }
      if (sq.imageElements) {
        for (const ie of sq.imageElements) {
          ie.id = mappings.imageElement[ie.id] ?? ie.id
        }
      }

      for (const bq of sq.branchQuestions) {
        bq.id = mappings.branchQuestion[bq.id] ?? bq.id

        for (const te of bq.textElements) {
          te.id = mappings.textElement[te.id] ?? te.id
        }
        if (bq.imageElements) {
          for (const ie of bq.imageElements) {
            ie.id = mappings.imageElement[ie.id] ?? ie.id
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
