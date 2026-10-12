/**
 * 最終確認ステップのサマリー計算（取り込み実行前の見込み）
 */

import type {
  CategoryIdIntegrationConfig,
  MatchedItem,
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
 * 生徒/学級/小計グループのサマリーを計算
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

  /**
   * 同じ実体だと決まった行を「書き換わる」「そのまま」へ数える。
   * どちらになるかは取り込みの方針だけで決まる（項目ごとの選択は無い）。
   */
  const countLinked = (match: MatchedItem) => {
    if (takesArchiveRow(match, action)) {
      updated++
    } else {
      kept++
    }
  }

  const countUpdateDecision = (importId: string) => {
    const match = [
      ...preMatch.byId,
      ...(preMatch.byStudentNumber ?? []),
      ...(preMatch.byName ?? []),
    ].find((candidate) => candidate.importId === importId)
    if (match) countLinked(match)
  }

  // ID一致
  for (const match of preMatch.byId) {
    countLinked(match)
  }

  const getDecision = (importId: string) => {
    return config.decisions.find((decision) => decision.importId === importId)
  }

  /**
   * 学籍番号一致・名前一致の1件を数える。2つの段で違うのは「どの方針ならその段の一致を
   * 既定で同じ実体とみなすか」だけなので、それを引数で受け取る。
   */
  const countMatchDecision = (
    match: MatchedItem,
    strategyAcceptsMatch: boolean
  ) => {
    const decision = getDecision(match.importId)

    if (strategyAcceptsMatch) {
      if (!decision || decision.decisionType === "same_person") {
        countUpdateDecision(match.importId)
        if (decision?.idChoice === "use_import_id") {
          idChangeToImport++
        }
      } else if (decision.decisionType === "create_new") {
        newCount++
      } else if (decision.decisionType === "skip") {
        skipped++
      }
    } else if (config.strategy === "all_new") {
      if (!decision || decision.decisionType === "create_new") {
        newCount++
      } else if (decision.decisionType === "skip") {
        skipped++
      }
    } else {
      if (decision?.decisionType === "same_person") {
        countUpdateDecision(match.importId)
        if (decision.idChoice === "use_import_id") {
          idChangeToImport++
        }
      } else if (decision?.decisionType === "skip") {
        skipped++
      } else {
        newCount++
      }
    }
  }

  // 学籍番号一致
  if (preMatch.byStudentNumber) {
    for (const match of preMatch.byStudentNumber) {
      countMatchDecision(
        match,
        config.strategy === "by_student_number" || config.strategy === "by_name"
      )
    }
  }

  // 名前一致
  if (preMatch.byName) {
    for (const match of preMatch.byName) {
      const alreadyProcessed = preMatch.byStudentNumber?.some(
        (studentNumberMatch) => studentNumberMatch.importId === match.importId
      )
      if (alreadyProcessed) continue

      countMatchDecision(match, config.strategy === "by_name")
    }
  }

  // 一致なし
  for (const item of preMatch.noMatch) {
    const decision = getDecision(item.importId)
    if (decision?.decisionType === "skip") {
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
function takesArchiveRow(match: MatchedItem, action: ImportAction): boolean {
  if (action === "overwrite") return true
  if (action === "separate") return false
  const importUpdatedAt = match.importData.updatedAt
  const existingUpdatedAt = match.existingData?.updatedAt
  if (typeof importUpdatedAt !== "string") return false
  if (typeof existingUpdatedAt !== "string") return true
  return new Date(importUpdatedAt) > new Date(existingUpdatedAt)
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
