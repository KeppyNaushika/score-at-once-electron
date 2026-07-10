/**
 * V1.5.0 → V1.6.0 変換器
 *
 * 変更点:
 * - DrawingAnnotation に isFavorite フィールドを追加（デフォルト: false）
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_5_0_to_V1_6_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.5.0"
  readonly toVersion: ExamArchiveVersion = "1.6.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    // DrawingAnnotation に isFavorite を追加
    const drawingAnnotations = data.scoresData.drawingAnnotations.map(
      (drawingAnnotation) => ({
        ...drawingAnnotation,
        isFavorite:
          "isFavorite" in drawingAnnotation &&
          drawingAnnotation.isFavorite === true,
      })
    )

    const annotationCount = drawingAnnotations.length
    if (annotationCount > 0) {
      warnings.push(
        `${annotationCount}件の描画アノテーションに isFavorite フィールドを追加しました（デフォルト: false）`
      )
    }

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        scoresData: {
          ...data.scoresData,
          drawingAnnotations,
        },
      },
      warnings,
    }
  }
}
