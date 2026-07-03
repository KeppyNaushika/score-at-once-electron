/**
 * 競合検出モジュール
 *
 * マッチング結果から競合を検出し、詳細情報を生成
 */

import type {
  CategoryMatchingResult,
  ConflictCategory,
  ConflictDetectionResult,
  ConflictItem,
  MatchingConfig,
  MatchingSummary,
} from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { type MatchResult, performAllMatching } from "./matcher"

/**
 * 2つの値が異なるかどうかを比較
 */
function hasDataDifference(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown>,
  excludeKeys: string[] = ["id", "createdAt", "updatedAt"]
): boolean {
  const keysToCheck = Object.keys(importData).filter(
    (k) => !excludeKeys.includes(k)
  )

  for (const key of keysToCheck) {
    if (JSON.stringify(importData[key]) !== JSON.stringify(existingData[key])) {
      return true
    }
  }

  return false
}

/**
 * マッチング結果から競合アイテムを生成
 */
function createConflictItems<
  T extends Record<string, unknown> & { id: string },
>(
  results: MatchResult<T>[],
  category: ConflictCategory,
  labelGenerator: (data: T) => string
): ConflictItem[] {
  const conflicts: ConflictItem[] = []

  for (const result of results) {
    if (result.existingData) {
      // データに差異があるかチェック
      if (hasDataDifference(result.importData, result.existingData)) {
        conflicts.push({
          id: `${category}-${result.importData.id}`,
          category,
          importData: result.importData,
          existingData: result.existingData,
          displayLabel: labelGenerator(result.importData),
        })
      }
    }
  }

  return conflicts
}

/**
 * マッチング結果からサマリーを生成
 */
function createMatchingSummary<
  T extends Record<string, unknown> & { id: string },
>(results: MatchResult<T>[]): MatchingSummary {
  let matched = 0
  let newItems = 0
  let conflicts = 0

  for (const result of results) {
    if (!result.existingData) {
      newItems++
    } else {
      if (hasDataDifference(result.importData, result.existingData)) {
        conflicts++
      } else {
        matched++
      }
    }
  }

  return { matched, newItems, conflicts }
}

/**
 * IDマッピングを生成
 */
function createIdMapping<T extends { id: string }>(
  results: MatchResult<T>[]
): Record<string, string> {
  const mapping: Record<string, string> = {}

  for (const result of results) {
    if (result.existingData) {
      mapping[result.importData.id] = result.existingData.id
    } else {
      // 新規の場合は同じIDを維持（後で新規生成されるかも）
      mapping[result.importData.id] = result.importData.id
    }
  }

  return mapping
}

/**
 * 全カテゴリの競合を検出
 */
export async function detectAllConflicts(
  importData: ExtractedArchiveData,
  config: MatchingConfig
): Promise<ConflictDetectionResult> {
  const warnings: string[] = []

  try {
    // 全カテゴリでマッチングを実行
    const matchResults = await performAllMatching(importData, config)

    // 各カテゴリの結果を生成
    const results: CategoryMatchingResult[] = []

    // 生徒
    const studentConflicts = createConflictItems(
      matchResults.students,
      "Student",
      (student) =>
        `${student.lastName} ${student.firstName} (${student.studentNumber})`
    )
    results.push({
      category: "Student",
      summary: createMatchingSummary(matchResults.students),
      conflictItems: studentConflicts,
      idMapping: createIdMapping(matchResults.students),
    })

    // 学級
    const classConflicts = createConflictItems(
      matchResults.classes,
      "Class",
      (classroom) => classroom.name
    )
    results.push({
      category: "Class",
      summary: createMatchingSummary(matchResults.classes),
      conflictItems: classConflicts,
      idMapping: createIdMapping(matchResults.classes),
    })

    // ユーザー
    const userConflicts = createConflictItems(
      matchResults.users,
      "User",
      (user) => `${user.name} (${user.username})`
    )
    results.push({
      category: "User",
      summary: createMatchingSummary(matchResults.users),
      conflictItems: userConflicts,
      idMapping: createIdMapping(matchResults.users),
    })

    // 小計グループ
    const subtotalGroupConflicts = createConflictItems(
      matchResults.subtotalGroups,
      "SubtotalGroup",
      (subtotalGroup) => subtotalGroup.name
    )
    results.push({
      category: "SubtotalGroup",
      summary: createMatchingSummary(matchResults.subtotalGroups),
      conflictItems: subtotalGroupConflicts,
      idMapping: createIdMapping(matchResults.subtotalGroups),
    })

    // 試験は常に新規作成モードのみ（この関数では検出しない）
    // QuestionScoreとDrawingAnnotationは生徒・設問のマッチング後に検出

    return {
      success: true,
      results,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error("Error detecting conflicts:", error)
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : "競合検出に失敗しました",
    }
  }
}
