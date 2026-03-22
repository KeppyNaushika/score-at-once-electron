/**
 * V1.8.0 → V1.9.0 変換器
 *
 * 変更点:
 * - DeletedRecord (tombstone) サポートの追加
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_8_0_to_V1_9_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.8.0"
  readonly toVersion: ArchiveVersion = "1.9.0"

  transform(data: ArchiveData): TransformResult {
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
