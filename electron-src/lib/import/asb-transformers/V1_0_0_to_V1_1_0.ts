/**
 * ASB v1.0.0 → v1.1.0 変換器
 *
 * 主な変更点:
 * - manuscriptCharGuides（JSON配列）を DB上で AsbCharGuide テーブルへ分離（issue #913）。
 *   これに伴いドメイン型 ManuscriptCharGuide に安定ID（id）を導入した。
 *
 * v1.0.0形式のアーカイブの charGuides には id が無いため、ここで生成して補完する。
 * あわせて counts.charGuides を再集計する（旧マニフェストには存在しないカウント）。
 */

import * as crypto from "crypto"

import type {
  AsbArchiveData,
  AsbArchiveVersion,
  AsbTransformResult,
  AsbVersionTransformer,
} from "../../../../src/types/asbArchive.types"

export class V1_0_0_to_V1_1_0_Transformer implements AsbVersionTransformer {
  readonly fromVersion: AsbArchiveVersion = "1.0.0"
  readonly toVersion: AsbArchiveVersion = "1.1.0"

  transform(data: AsbArchiveData): AsbTransformResult {
    let charGuides = 0

    const majorQuestions = data.definition.majorQuestions.map(
      (majorQuestion) => ({
        ...majorQuestion,
        subQuestions: majorQuestion.subQuestions.map((subQuestion) => {
          const manuscriptPaper = subQuestion.manuscriptPaper
          if (!manuscriptPaper?.charGuides) return subQuestion
          charGuides += manuscriptPaper.charGuides.length
          return {
            ...subQuestion,
            manuscriptPaper: {
              ...manuscriptPaper,
              charGuides: manuscriptPaper.charGuides.map((charGuide) => ({
                ...charGuide,
                id: charGuide.id ?? crypto.randomUUID(),
              })),
            },
          }
        }),
      })
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
          counts: { ...data.manifest.counts, charGuides },
        },
        definition: { ...data.definition, majorQuestions },
      },
      warnings: [],
    }
  }
}
