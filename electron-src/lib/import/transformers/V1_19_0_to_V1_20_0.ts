import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/**
 * 1.19.0 → 1.20.0
 *
 * CropRegionAssignment（設問ごとの採点担当）を追加。旧アーカイブには担当の情報が
 * 無いので空配列で補完する。担当0人は「全員担当」を意味するため、
 * 空のままインポートしても採点できる設問集合は従来どおり全設問になる。
 */
export class V1_19_0_to_V1_20_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.19.0"
  readonly toVersion: ExamArchiveVersion = "1.20.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        scoresData: {
          ...data.scoresData,
          cropRegionAssignments: data.scoresData.cropRegionAssignments ?? [],
        },
      },
      warnings: [],
    }
  }
}
