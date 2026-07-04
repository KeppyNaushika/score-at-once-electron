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

export interface AsbArchiveData {
  manifest: AsbArchiveManifest
  definition: AnswerSheetDefinition
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

export type AsbArchiveVersion = "1.0.0" | "1.1.0"
export const ASB_CURRENT_VERSION: AsbArchiveVersion = "1.1.0"
export const ASB_SUPPORTED_VERSIONS: readonly AsbArchiveVersion[] = [
  "1.0.0",
  "1.1.0",
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
}
