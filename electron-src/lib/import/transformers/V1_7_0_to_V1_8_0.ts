/**
 * V1.7.0 → V1.8.0 変換器
 *
 * 変更点:
 * - MasterImage に pageSize フィールドを追加（デフォルト: "A4"）
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_7_0_to_V1_8_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.7.0"
  readonly toVersion: ArchiveVersion = "1.8.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    // v1.7.0 以前のアーカイブには masterImages に pageSize が存在しない
    // デフォルト値 "A4" を追加
    const masterImages = (data.examData.masterImages ?? []).map((img) => ({
      ...img,
      pageSize: img.pageSize ?? "A4",
    }))

    const examData = {
      ...data.examData,
      masterImages,
    }

    warnings.push(
      "v1.8.0: MasterImage に pageSize フィールドを追加しました（デフォルト: A4）"
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        examData,
      },
      warnings,
    }
  }
}
