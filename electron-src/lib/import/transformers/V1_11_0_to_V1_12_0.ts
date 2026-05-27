/**
 * v1.11.0 → v1.12.0 変換器
 *
 * 主な変更点:
 * - Exam.markerCorrectionEnabled 追加（ASB由来試験の答案アップロード時にマーク補正既定ONにする）
 *
 * v1.11.0形式のアーカイブには markerCorrectionEnabled が存在しないため、
 * デフォルト値 false で補完する（旧バージョンのExamはASB由来情報を持たないため安全側に倒す）
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_11_0_to_V1_12_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.11.0"
  readonly toVersion: ArchiveVersion = "1.12.0"

  transform(data: ArchiveData): TransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: {
          ...data.examData,
          exam: {
            ...data.examData.exam,
            markerCorrectionEnabled:
              data.examData.exam.markerCorrectionEnabled ?? false,
          },
        },
      },
      warnings: [
        `1.11.0→1.12.0: Exam.markerCorrectionEnabled をデフォルト値(false)で補完しました`,
      ],
    }
  }
}
