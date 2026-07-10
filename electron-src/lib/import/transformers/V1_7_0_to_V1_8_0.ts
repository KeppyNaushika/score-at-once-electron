/**
 * V1.7.0 → V1.8.0 変換器
 *
 * 変更点:
 * - MasterImage に pageSize フィールドを追加（デフォルト: "A4"）
 * - DrawingAnnotation の strokeWidth / fontSize をピクセル値からmm値に変換
 *
 * ⚠️ px→mm 変換は値からは px か mm か判別できないため【冪等でない】。
 * 本変換器が二重適用されないよう、バージョン検出の形状フロア
 * （transformers/index.ts の SHAPE_VERSION_FLOORS）は 1.7.0 以下への
 * 引き下げを「現行キーが欠落した本物の旧形状」に限定している。
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/**
 * 用紙サイズ（mm）
 */
const PAPER_DIMENSIONS: Record<string, { width: number; height: number }> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  B4: { width: 257, height: 364 },
  B5: { width: 182, height: 257 },
}

/**
 * PDF scale=2.0 を仮定した概算画像幅ピクセル数
 * 72dpi × 2.0 = 144dpi → 1mm ≈ 5.669px
 */
function getEstimatedImageWidthPx(pageSize: string): number {
  const paper = PAPER_DIMENSIONS[pageSize] ?? PAPER_DIMENSIONS.A4
  const pxPerMm = (72 * 2) / 25.4
  return Math.round(paper.width * pxPerMm)
}

/**
 * ピクセル値をmm値に概算変換
 */
function pxToMm(px: number, pageSize: string): number {
  const imageWidthPx = getEstimatedImageWidthPx(pageSize)
  const paper = PAPER_DIMENSIONS[pageSize] ?? PAPER_DIMENSIONS.A4
  return Math.round(((px * paper.width) / imageWidthPx) * 100) / 100
}

export class V1_7_0_to_V1_8_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.7.0"
  readonly toVersion: ExamArchiveVersion = "1.8.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    // 1. MasterImage に pageSize を追加
    const masterImages = (data.examData.masterImages ?? []).map((img) => ({
      ...img,
      pageSize: img.pageSize ?? "A4",
    }))

    // masterImagesからpageSizeを取得（最初の画像のpageSizeを基準に使用）
    const pageSize = masterImages[0]?.pageSize ?? "A4"

    // 2. DrawingAnnotation の strokeWidth / fontSize を px→mm 変換
    const drawingAnnotations = (data.scoresData.drawingAnnotations ?? []).map(
      (da) => ({
        ...da,
        strokeWidth: pxToMm(da.strokeWidth, pageSize),
        fontSize: pxToMm(da.fontSize, pageSize),
      })
    )

    const examData = {
      ...data.examData,
      masterImages,
    }

    const scoresData = {
      ...data.scoresData,
      drawingAnnotations,
    }

    warnings.push(
      "v1.8.0: MasterImage に pageSize フィールドを追加しました（デフォルト: A4）"
    )
    if (drawingAnnotations.length > 0) {
      warnings.push(
        `v1.8.0: DrawingAnnotation ${drawingAnnotations.length}件の strokeWidth/fontSize をpx→mm変換しました（${pageSize}基準）`
      )
    }

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        examData,
        scoresData,
      },
      warnings,
    }
  }
}
