/**
 * 最終確認ステップのサマリー計算（取り込み実行前の見込み）
 */

import {
  existingRowsById,
  resolveIdIntegrationRows,
} from "@/components/import/idIntegrationRows"
import type {
  CategoryIdIntegrationConfig,
  PreMatchingResult,
  ScoringConflict,
  ScoringConflictData,
} from "@/types/examArchive.types"
import type { ImportAction } from "@/types/importAction.types"

import type { CategorySummary } from "./types"

// =============================================================================
// カテゴリ別サマリー計算
// =============================================================================

/**
 * 生徒/学級/小計グループのサマリーを計算（取り込み時と同じ決まりで、行ごとの扱いを数える）
 */
export function calculateCategorySummary(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig,
  action: ImportAction
): CategorySummary {
  let newCount = 0
  let skipped = 0
  let idChangeToImport = 0
  let updated = 0
  let kept = 0

  const existingRows = existingRowsById(preMatch)
  /**
   * 同じ実体だと決まった行を「書き換わる」「そのまま」へ数える。
   * どちらになるかは取り込みの方針だけで決まる（項目ごとの選択は無い）。
   */
  const countLinked = (
    importData: Record<string, unknown>,
    existingData: Record<string, unknown> | undefined
  ) => {
    if (takesArchiveRow(importData, existingData, action)) {
      updated++
    } else {
      kept++
    }
  }

  // ID一致（必ず同じもの）
  for (const match of preMatch.byId) {
    countLinked(match.importData, match.existingData)
  }

  for (const row of resolveIdIntegrationRows(preMatch, config)) {
    const { decision } = row
    if (decision.decisionType === "same_person") {
      countLinked(
        row.importData,
        decision.existingId ? existingRows.get(decision.existingId) : undefined
      )
      if (decision.idChoice === "use_import_id") idChangeToImport++
    } else if (decision.decisionType === "skip") {
      skipped++
    } else {
      newCount++
    }
  }

  return {
    unchanged: kept,
    updated,
    newCount,
    skipped,
    idChangeToImport,
  }
}

// =============================================================================
// 採点データサマリー計算
// =============================================================================

/**
 * 採点データの予測サマリーを計算
 */
export function calculateScoringSummary(
  scoringConflicts: ScoringConflictData | undefined,
  action: ImportAction,
  totalScoresInArchive: number
): Omit<CategorySummary, "idChangeToImport"> {
  if (!scoringConflicts) {
    return {
      unchanged: 0,
      updated: 0,
      newCount: totalScoresInArchive,
      skipped: 0,
    }
  }

  let updated = 0
  let skipped = 0

  // conflicts にはデータが異なるもののみ含まれる。
  // 採点も他の値と同じ方針で決まる（上書き=ファイル / 統合=後に書かれた方）
  for (const conflict of scoringConflicts.conflicts) {
    if (takesArchiveScore(conflict, action)) {
      updated++
    } else {
      skipped++
    }
  }

  // unchangedCount はバックエンドで計算される。未設定の場合はフォールバック計算
  const unchangedCount =
    scoringConflicts.unchangedCount ??
    totalScoresInArchive -
      scoringConflicts.newCount -
      scoringConflicts.conflictCount

  return {
    unchanged: Math.max(0, unchangedCount),
    updated,
    newCount: scoringConflicts.newCount,
    skipped,
  }
}

/**
 * 同じ実体だと決まった行が、ファイル側の値で書き換わるか（実行前の見込み）
 *
 * main の importValuePolicy と同じ規則。別で追加するときは既存に触らない。
 */
function takesArchiveRow(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown> | undefined,
  action: ImportAction
): boolean {
  if (action === "overwrite") return true
  if (action === "separate") return false
  const importUpdatedAt = timeOf(importData.updatedAt)
  const existingUpdatedAt = timeOf(existingData?.updatedAt)
  if (importUpdatedAt === null) return false
  if (existingUpdatedAt === null) return true
  return importUpdatedAt > existingUpdatedAt
}

/** 時刻の値（Date または ISO 文字列）をミリ秒にする。読めなければ null */
function timeOf(moment: unknown): number | null {
  const parsed =
    moment instanceof Date
      ? moment
      : typeof moment === "string"
        ? new Date(moment)
        : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null
}

/**
 * 重なった採点のうち、ファイル側が採られるか（実行前の見込み）
 *
 * 判定は main の importValuePolicy と同じ規則。ここは表示のための予測で、
 * 書き込みの判断そのものは main が行う。
 */
function takesArchiveScore(
  conflict: ScoringConflict,
  action: ImportAction
): boolean {
  if (action === "overwrite") return true
  if (action === "separate") return false
  return (
    new Date(conflict.importScore.updatedAt) >
    new Date(conflict.existingScore.updatedAt)
  )
}
