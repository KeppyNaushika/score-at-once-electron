/**
 * 解答用紙定義アーカイブ (.asb) の型定義
 */

import type { AnswerSheetDefinition } from "./answerSheetDefinition.types"

// =============================================================================
// マニフェスト
// =============================================================================

export interface AsbArchiveDataCounts {
  headerFields: number
  majorQuestions: number
  subQuestions: number
  branchQuestions: number
  textElements: number
  imageElements: number
  charGuides: number
  omrConfigs: number
  images: number
  tags: number
}

export interface AsbArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  definitionName: string
  paperSize: string
  orientation: string
  counts: AsbArchiveDataCounts
}

// =============================================================================
// アーカイブデータ
// =============================================================================

/** アーカイブに同梱するタグ本体（v1.2.0+）。UUID一次照合＋name upsert で復元する。 */
export interface ArchiveAsbTag {
  id: string
  name: string
  order: number
  color: string | null
}

/** 定義へのタグ参照（v1.2.0+）。tagId は ArchiveAsbTag.id を指す。 */
export interface AsbDefinitionTagRef {
  tagId: string
}

export interface AsbArchiveData {
  manifest: AsbArchiveManifest
  definition: AnswerSheetDefinition
  /** タグ本体（v1.2.0+）。旧バージョンでは transformer が空配列で補完する。 */
  tagsData?: ArchiveAsbTag[]
  /** 定義へのタグ参照（v1.2.0+）。 */
  asbDefinitionTags?: AsbDefinitionTagRef[]
}

// =============================================================================
// Transformer
// =============================================================================

export interface AsbTransformResult {
  data: AsbArchiveData
  warnings: string[]
}

export interface AsbVersionTransformer {
  readonly fromVersion: AsbArchiveVersion
  readonly toVersion: AsbArchiveVersion
  transform(data: AsbArchiveData): AsbTransformResult
}

export interface AsbChainTransformResult {
  data: AsbArchiveData
  originalVersion: AsbArchiveVersion
  finalVersion: AsbArchiveVersion
  appliedTransformations: { from: AsbArchiveVersion; to: AsbArchiveVersion }[]
  warnings: string[]
}

// =============================================================================
// バージョン
// =============================================================================

/**
 * | バージョン | 変更内容                                                              |
 * | ---------- | --------------------------------------------------------------------- |
 * | 1.0.0      | 初版                                                                  |
 * | 1.1.0      | 文字位置マーカーを JSON 列から独立テーブルへ                          |
 * | 1.2.0      | タグ本体と定義へのタグ参照を同梱                                      |
 * | 1.3.0      | 描き分け（renderMode）を解答用紙の属性から外す                        |
 * | 1.4.0      | 原稿用紙をテーブルへ（id を持ち、枝問にも付く。マーカーの親も原稿用紙）|
 * | 1.5.0      | 解答用紙に使用日（referenceDate）と説明（description）を新設         |
 */
export type AsbArchiveVersion =
  "1.0.0" | "1.1.0" | "1.2.0" | "1.3.0" | "1.4.0" | "1.5.0"
export const ASB_CURRENT_VERSION: AsbArchiveVersion = "1.5.0"
export const ASB_SUPPORTED_VERSIONS: readonly AsbArchiveVersion[] = [
  "1.0.0",
  "1.1.0",
  "1.2.0",
  "1.3.0",
  "1.4.0",
  "1.5.0",
] as const

// =============================================================================
// IDリマッピング
// =============================================================================

export interface AsbIdMappings {
  definition: Record<string, string>
  headerField: Record<string, string>
  majorQuestion: Record<string, string>
  subQuestion: Record<string, string>
  branchQuestion: Record<string, string>
  textElement: Record<string, string>
  imageElement: Record<string, string>
  charGuide: Record<string, string>
  omrConfig: Record<string, string>
  manuscriptPaper: Record<string, string>
}
