/**
 * 試験外成績資料アーカイブ バージョントランスフォーマーの型定義
 *
 * 初版（v1.0.0）は変換器ゼロ。将来スキーマが変わったら V1_0_0_to_V1_1_0.ts 等を追加し
 * COURSEWORK_TRANSFORMERS へ登録してチェーン化する（exam-archive の transformers に倣う）。
 */

import type { CourseworkArchiveData } from "../../../../../src/types/courseworkArchive.types"

export { COURSEWORK_CURRENT_VERSION } from "../../../../../src/types/courseworkArchive.types"

export type CourseworkArchiveVersion = "1.0.0"

export const COURSEWORK_SUPPORTED_VERSIONS: readonly CourseworkArchiveVersion[] =
  ["1.0.0"]

export interface CourseworkTransformResult {
  data: CourseworkArchiveData
  warnings: string[]
}

export interface CourseworkVersionTransformer {
  readonly fromVersion: CourseworkArchiveVersion
  readonly toVersion: CourseworkArchiveVersion
  transform(data: CourseworkArchiveData): CourseworkTransformResult
}
