/**
 * 1.16.0 → 1.17.0: 比較（GradeComparison）のセクションを足す。
 *
 * 運ぶもの:
 * - `gradeComparisons`（比較の行）と `comparedGradeItemRefs`（別の成績算出にある相手の
 *   同定情報）の新設。旧版には比較という機能が無いので、どちらも空で補う
 *   （**空で埋めるのが正しい** —— 失われた比較というものが存在しない）。よって警告も出さない
 *
 * 値そのものは変わらない。1.17.0 の形に対しては何もしない（冪等）。
 */

import type { GradeArchiveVersion } from "../../../../src/types/gradeArchive.types"
import type {
  AnyGradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "./types"
import { isGradeArchiveV1_16_0 } from "./types"

export class V1_16_0_to_V1_17_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.16.0"
  readonly toVersion: GradeArchiveVersion = "1.17.0"

  transform(data: AnyGradeArchiveData): GradeTransformResult {
    if (!isGradeArchiveV1_16_0(data)) {
      return { data, warnings: [] }
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        gradeComparisons: [],
        comparedGradeItemRefs: [],
      },
      warnings: [],
    }
  }
}
