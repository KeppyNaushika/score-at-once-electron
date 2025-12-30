/**
 * 競合検出モジュール
 *
 * マッチング結果から競合を検出し、詳細情報を生成
 */

import type {
  ConflictCategory,
  ConflictItem,
  MatchingSummary,
  CategoryMatchingResult,
  ConflictDetectionResult,
  MatchingConfig,
} from "../../../../types/project-archive.types"
import type { ExtractedArchiveData } from "../project-archive/archive-extractor"
import {
  performAllMatching,
  type MatchResult,
} from "./matcher"

/**
 * 2つの値が異なるかどうかを比較
 */
function hasDataDifference(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown>,
  excludeKeys: string[] = ["id", "createdAt", "updatedAt"],
): boolean {
  const keysToCheck = Object.keys(importData).filter(
    (k) => !excludeKeys.includes(k),
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
function createConflictItems<T extends { id: string }>(
  results: MatchResult<T>[],
  category: ConflictCategory,
  labelGenerator: (data: T) => string,
): ConflictItem[] {
  const conflicts: ConflictItem[] = []

  for (const result of results) {
    if (result.existingData) {
      // データに差異があるかチェック
      const importObj = result.importData as unknown as Record<string, unknown>
      const existingObj = result.existingData as unknown as Record<string, unknown>

      if (hasDataDifference(importObj, existingObj)) {
        conflicts.push({
          id: `${category}-${result.importData.id}`,
          category,
          importData: importObj,
          existingData: existingObj,
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
function createMatchingSummary<T extends { id: string }>(
  results: MatchResult<T>[],
): MatchingSummary {
  let matched = 0
  let newItems = 0
  let conflicts = 0

  for (const result of results) {
    if (!result.existingData) {
      newItems++
    } else {
      const importObj = result.importData as unknown as Record<string, unknown>
      const existingObj = result.existingData as unknown as Record<string, unknown>

      if (hasDataDifference(importObj, existingObj)) {
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
  results: MatchResult<T>[],
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
  config: MatchingConfig,
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
      (s) => `${s.lastName} ${s.firstName} (${s.studentId})`,
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
      (c) => c.name,
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
      (u) => `${u.name} (${u.username})`,
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
      (sg) => sg.name,
    )
    results.push({
      category: "SubtotalGroup",
      summary: createMatchingSummary(matchResults.subtotalGroups),
      conflictItems: subtotalGroupConflicts,
      idMapping: createIdMapping(matchResults.subtotalGroups),
    })

    // プロジェクトは常に新規作成モードのみ（この関数では検出しない）
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
      error:
        error instanceof Error
          ? error.message
          : "競合検出に失敗しました",
    }
  }
}

/**
 * 採点データの競合を検出
 *
 * 生徒と設問がマッチした上で、スコアに差異がある場合に競合として報告
 */
export async function detectScoreConflicts(
  importData: ExtractedArchiveData,
  _studentIdMapping: Record<string, string>,
  _cropRegionIdMapping: Record<string, string>,
): Promise<CategoryMatchingResult[]> {
  const results: CategoryMatchingResult[] = []

  // TODO: QuestionScoreの競合検出
  // 既存のQuestionScoreを取得し、studentId + cropRegionIdでマッチング
  // 差異がある場合は競合として報告

  // QuestionScore (プレースホルダー)
  results.push({
    category: "QuestionScore",
    summary: { matched: 0, newItems: importData.scoresData.questionScores.length, conflicts: 0 },
    conflictItems: [],
    idMapping: {},
  })

  // DrawingAnnotation (プレースホルダー)
  results.push({
    category: "DrawingAnnotation",
    summary: { matched: 0, newItems: importData.scoresData.drawingAnnotations.length, conflicts: 0 },
    conflictItems: [],
    idMapping: {},
  })

  return results
}
