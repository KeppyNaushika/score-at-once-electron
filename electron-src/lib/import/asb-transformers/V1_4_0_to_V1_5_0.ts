/**
 * ASB v1.4.0 → v1.5.0 変換器
 *
 * 解答用紙に2つの列を足した。
 * - `referenceDate`（使用日）—— 4つの一覧が「その実体がいつのものか」を同じ列で持てるよう、
 *   試験・資料・成績と同じ名前で解答用紙にも足した
 * - `description`（説明）—— 説明を持っていたのは試験・資料・成績の3つだけで、
 *   解答用紙だけが持っていなかった
 *
 * どちらも旧アーカイブには入れる場所そのものが無かったので `null` で補う。
 * **警告は出さない** —— 旧版では入力する画面が無く、失われた値というものが存在しない。
 *
 * 既に値がある行はそのまま残すので冪等。
 */

import type {
  AsbArchiveData,
  AsbArchiveVersion,
  AsbTransformResult,
  AsbVersionTransformer,
} from "../../../../src/types/asbArchive.types"

type ArchiveDefinition = AsbArchiveData["definition"]

/**
 * 使用日と説明を補う。引数の型で「まだ無いかもしれない」と名乗ることで、
 * 旧形式の解答用紙も現行形式のものも同じ関数へ渡せる（`as` は要らない）。
 */
const fillDefinitionColumns = (
  definition: Omit<ArchiveDefinition, "referenceDate" | "description"> & {
    referenceDate?: unknown
    description?: unknown
  }
): ArchiveDefinition => ({
  ...definition,
  referenceDate:
    typeof definition.referenceDate === "string"
      ? definition.referenceDate
      : null,
  description:
    typeof definition.description === "string" ? definition.description : null,
})

export class V1_4_0_to_V1_5_0_Transformer implements AsbVersionTransformer {
  readonly fromVersion: AsbArchiveVersion = "1.4.0"
  readonly toVersion: AsbArchiveVersion = "1.5.0"

  transform(data: AsbArchiveData): AsbTransformResult {
    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        definition: fillDefinitionColumns(data.definition),
      },
      warnings: [],
    }
  }
}
