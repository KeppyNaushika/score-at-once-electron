/**
 * ASB v1.2.0 → v1.3.0 変換器
 *
 * 主な変更点:
 * - `renderMode`（解答用紙／模範解答の描き分け）が解答用紙の属性でなくなった。
 *   **どちらの姿で見るかは使う人の作業の状態**なので、利用者の設定
 *   （`UserPreference.asbRenderMode`）へ移した。書き出しは常に両方を出す。
 *
 * 旧アーカイブは定義に `renderMode` を持っている。書き込み先の列が無いので落とす。
 * 落とす値は「その解答用紙を最後にどちらの姿で見ていたか」でしかなく、失われて困る
 * ものではない。
 */

import type {
  AsbArchiveData,
  AsbArchiveVersion,
  AsbTransformResult,
  AsbVersionTransformer,
} from "../../../../src/types/asbArchive.types"

type ArchiveDefinition = AsbArchiveData["definition"]

/** 1.2.0 までの定義。解答用紙ごとに描き分けを持っていた */
type DefinitionWithRenderMode = ArchiveDefinition & { renderMode?: string }

function withoutRenderMode(
  definition: DefinitionWithRenderMode
): ArchiveDefinition {
  const { renderMode: _renderMode, ...rest } = definition
  return rest
}

export class V1_2_0_to_V1_3_0_Transformer implements AsbVersionTransformer {
  readonly fromVersion: AsbArchiveVersion = "1.2.0"
  readonly toVersion: AsbArchiveVersion = "1.3.0"

  transform(data: AsbArchiveData): AsbTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        definition: withoutRenderMode(data.definition),
      },
      warnings: [],
    }
  }
}
