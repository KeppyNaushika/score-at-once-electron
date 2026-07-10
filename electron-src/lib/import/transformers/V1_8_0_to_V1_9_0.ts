/**
 * V1.8.0 → V1.9.0 変換器
 *
 * 変更点:
 * - DeletedRecord (tombstone) サポートの追加
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_8_0_to_V1_9_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.8.0"
  readonly toVersion: ExamArchiveVersion = "1.9.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        deletedRecordsData: data.deletedRecordsData ?? {
          deletedRecords: [],
        },
      },
      warnings: ["v1.9.0: DeletedRecord (tombstone) サポートを追加しました"],
    }
  }
}
