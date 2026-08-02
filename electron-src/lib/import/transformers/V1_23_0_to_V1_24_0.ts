/**
 * v1.23.0 → v1.24.0 変換器
 *
 * DrawingAnnotation.userId を廃止した。QuestionScore は「生徒×設問×採点者」で1行で、
 * 注釈は questionScoreId でその行にぶら下がるので、持ち主は親から一意に決まる。
 * 同じ情報を2箇所に持つと食い違いうる（親子で採点者が食い違った注釈は取得時の
 * 採点者絞りから漏れ、自分の注釈が自分に見えなくなる）ため、列ごと落とした。
 *
 * 旧アーカイブの注釈から userId を読み捨てる。エクスポート側は常に
 * 「注釈も親も自分のもの」だけを収集していたので、通常は親の採点者と一致しており
 * 情報は失われない。一致しない行があれば手編集などで壊れたアーカイブなので、
 * 取り込み後に持ち主が変わることを警告で伝える。
 *
 * キーが無い現行形式に対しては無変更で冪等。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_23_0_to_V1_24_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.23.0"
  readonly toVersion: ExamArchiveVersion = "1.24.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    const questionScoreUserById = new Map(
      (data.scoresData.questionScores ?? []).map((questionScore) => [
        questionScore.id,
        questionScore.userId,
      ])
    )

    let divergedCount = 0
    const drawingAnnotations = (data.scoresData.drawingAnnotations ?? []).map(
      (drawingAnnotation) => {
        const annotationRecord = {
          ...(drawingAnnotation as unknown as Record<string, unknown>),
        }
        const legacyUserId = annotationRecord.userId
        const parentUserId = questionScoreUserById.get(
          drawingAnnotation.questionScoreId
        )
        if (
          typeof legacyUserId === "string" &&
          parentUserId !== undefined &&
          legacyUserId !== parentUserId
        ) {
          divergedCount++
        }
        delete annotationRecord.userId
        return annotationRecord as unknown as (typeof data.scoresData.drawingAnnotations)[number]
      }
    )

    if (divergedCount > 0) {
      warnings.push(
        `1.23.0→1.24.0: 採点マーク${divergedCount}件で、マーク自身の採点者が親の採点データと食い違っていました。マークの持ち主は親の採点者として取り込みます。`
      )
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        scoresData: { ...data.scoresData, drawingAnnotations },
      },
      warnings,
    }
  }
}
