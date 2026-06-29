/**
 * 試験外成績資料アーカイブ バージョントランスフォーマー チェーン
 *
 * 初版は変換器ゼロ。transformToLatest は素通しする。
 * 将来 V<FROM>_to_V<TO> を追加したら COURSEWORK_TRANSFORMERS へ登録すること。
 */

import type { CourseworkArchiveData } from "../../../../../src/types/courseworkArchive.types"
import {
  COURSEWORK_CURRENT_VERSION,
  type CourseworkTransformResult,
  type CourseworkVersionTransformer,
} from "./types"

export * from "./types"

/** 登録済みトランスフォーマー（初版は空） */
export const COURSEWORK_TRANSFORMERS: CourseworkVersionTransformer[] = []

/**
 * アーカイブを現行バージョンへ変換する。
 * 該当する変換器が無ければ素通しする。
 */
export function transformCourseworkToLatest(
  data: CourseworkArchiveData
): CourseworkTransformResult {
  let current = data
  const warnings: string[] = []

  // 現行に到達するまでチェーンを辿る（初版は空配列なので即終了）
  let guard = 0
  while (current.manifest.version !== COURSEWORK_CURRENT_VERSION) {
    const transformer = COURSEWORK_TRANSFORMERS.find(
      (t) => t.fromVersion === current.manifest.version
    )
    if (!transformer) break
    const result = transformer.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    if (++guard > 100) break
  }

  return { data: current, warnings }
}
