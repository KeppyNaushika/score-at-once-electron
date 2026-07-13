/**
 * ASB v1.1.0 → v1.2.0 変換器
 *
 * 主な変更点:
 * - 解答用紙定義にタグを付与できるようになった（AsbDefinitionTag 中間テーブル）。
 *   アーカイブに tagsData（タグ本体）と asbDefinitionTags（定義への参照）を同梱する。
 *
 * v1.1.0形式のアーカイブにはタグ情報が無いため、空配列で補完する（no-op）。
 * counts.tags も旧マニフェストには存在しないため 0 で補う。
 */

import type {
  AsbArchiveData,
  AsbArchiveVersion,
  AsbTransformResult,
  AsbVersionTransformer,
} from "../../../../src/types/asbArchive.types"

export class V1_1_0_to_V1_2_0_Transformer implements AsbVersionTransformer {
  readonly fromVersion: AsbArchiveVersion = "1.1.0"
  readonly toVersion: AsbArchiveVersion = "1.2.0"

  transform(data: AsbArchiveData): AsbTransformResult {
    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
          counts: {
            ...data.manifest.counts,
            tags: data.manifest.counts.tags ?? 0,
          },
        },
        tagsData: data.tagsData ?? [],
        asbDefinitionTags: data.asbDefinitionTags ?? [],
      },
      warnings: [],
    }
  }
}
