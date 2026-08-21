/**
 * ASB v1.3.0 → v1.4.0 変換器
 *
 * 主な変更点:
 * - 原稿用紙が小問の列から独立テーブル（`AsbManuscriptPaper`）へ出た。**行そのものを
 *   持つ**ので id が付き、`enabled` / `guideFontSize` / `guidePosition` / `guidePadding`
 *   は「未指定」ではなく `null` を持つ。
 * - 同じ表が枝問にもぶら下がるようになった（旧アーカイブには枝問の原稿用紙が無い）。
 * - 文字位置マーカーの親が「小問」から「原稿用紙」へ移った。入れ子の位置は変わらないので
 *   ここで動かすものは無い。
 *
 * 旧アーカイブの原稿用紙は「有効なときだけ入れ子が在る」形だったので、**入れ子が在れば
 * `enabled: true`** と読む。id は取り込みのたびに振り直される値なので、ここで uuidv4 を
 * 与えてよい（`idRemapper` がさらに振り直す）。
 */

import * as crypto from "crypto"

import type {
  ManuscriptCharGuide,
  ManuscriptGuidePosition,
  ManuscriptPaper,
} from "../../../../src/types/answerSheetDefinition.types"
import type {
  AsbArchiveData,
  AsbArchiveVersion,
  AsbTransformResult,
  AsbVersionTransformer,
} from "../../../../src/types/asbArchive.types"

type ArchiveDefinition = AsbArchiveData["definition"]
type ArchiveMajorQuestion = ArchiveDefinition["majorQuestions"][number]
type ArchiveSubQuestion = ArchiveMajorQuestion["subQuestions"][number]

/** 1.3.0 までの原稿用紙。id を持たず、未指定は欠落で表していた */
interface LegacyManuscriptPaper {
  enabled?: boolean
  columns?: number
  rows?: number
  charGuides?: ManuscriptCharGuide[]
  guideFontSize?: number
  guidePosition?: ManuscriptGuidePosition
  guidePadding?: number
}

type LegacySubQuestion = Omit<ArchiveSubQuestion, "manuscriptPaper"> & {
  manuscriptPaper?: LegacyManuscriptPaper
}

function toManuscriptPaper(legacy: LegacyManuscriptPaper): ManuscriptPaper {
  return {
    id: crypto.randomUUID(),
    // 旧形式は「有効なときだけ入れ子が在る」形だった
    enabled: legacy.enabled ?? true,
    columns: legacy.columns ?? 20,
    rows: legacy.rows ?? 10,
    guideFontSize: legacy.guideFontSize ?? null,
    guidePosition: legacy.guidePosition ?? null,
    guidePadding: legacy.guidePadding ?? null,
    charGuides: legacy.charGuides ?? [],
  }
}

function upgradeSubQuestion(
  legacySubQuestion: LegacySubQuestion
): ArchiveSubQuestion {
  const { manuscriptPaper, ...rest } = legacySubQuestion
  return {
    ...rest,
    manuscriptPaper: manuscriptPaper
      ? toManuscriptPaper(manuscriptPaper)
      : undefined,
  }
}

export class V1_3_0_to_V1_4_0_Transformer implements AsbVersionTransformer {
  readonly fromVersion: AsbArchiveVersion = "1.3.0"
  readonly toVersion: AsbArchiveVersion = "1.4.0"

  transform(data: AsbArchiveData): AsbTransformResult {
    const majorQuestions = data.definition.majorQuestions.map(
      (majorQuestion) => ({
        ...majorQuestion,
        subQuestions: majorQuestion.subQuestions.map((subQuestion) =>
          upgradeSubQuestion(subQuestion as LegacySubQuestion)
        ),
      })
    )
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        definition: { ...data.definition, majorQuestions },
      },
      warnings: [],
    }
  }
}
