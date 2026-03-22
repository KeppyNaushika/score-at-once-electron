/**
 * 競合検出モジュール
 *
 * マッチング結果から競合を検出し、詳細情報を生成
 */

import type {
  CategoryMatchingResult,
  CategoryMatchingSummary,
  ConflictCategory,
  ConflictDetectionResult,
  ConflictItem,
  FieldChange,
  MatchingCandidate,
  MatchingConfig,
  MatchingSummary,
} from "../../../../types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import { type MatchResult, performAllMatching } from "./matcher"

// =============================================================================
// フィールドラベルマッピング（先生向けUI表示用）
// =============================================================================

/**
 * カテゴリ別のフィールドラベル
 * 技術的なフィールド名を先生が理解できる日本語に変換
 */
const FIELD_LABELS: Record<ConflictCategory, Record<string, string>> = {
  Student: {
    studentNumber: "学籍番号",
    lastName: "姓",
    firstName: "名",
    lastNameKana: "姓カナ",
    firstNameKana: "名カナ",
    enrollmentYear: "入学年度",
  },
  Class: {
    name: "学級名",
    classCode: "学級コード",
    grade: "学年",
    description: "説明",
    isVisible: "表示",
  },
  User: {
    username: "ユーザー名",
    name: "氏名",
    role: "役割",
  },
  SubtotalGroup: {
    name: "グループ名",
  },
  Exam: {
    examName: "試験名",
    examDate: "試験日",
    subject: "教科",
    description: "説明",
  },
  QuestionScore: {
    partialScore: "得点",
    status: "採点状態",
  },
  DrawingAnnotation: {
    type: "種類",
    text: "テキスト",
    color: "色",
  },
}

/**
 * マッチング理由の生成（先生向け表示用）
 */
function generateMatchReason(
  category: ConflictCategory,
  matchMethod: string
): string {
  switch (category) {
    case "Student":
      if (matchMethod === "studentNumber") return "学籍番号が一致"
      if (matchMethod === "name") return "氏名が一致"
      return "学籍番号と氏名が一致"
    case "Class":
      if (matchMethod === "name") return "学級名が一致"
      return "学級コードが一致"
    case "User":
      return "ユーザー名が一致"
    case "SubtotalGroup":
      return "グループ名が一致"
    default:
      return "データが一致"
  }
}

// =============================================================================
// 差分計算関数
// =============================================================================

/**
 * 2つのデータ間のフィールド差分を計算
 */
export function calculateFieldChanges(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown>,
  category: ConflictCategory
): FieldChange[] {
  const changes: FieldChange[] = []
  const labels = FIELD_LABELS[category] || {}
  const excludeKeys = ["id", "createdAt", "updatedAt"]

  for (const [field, label] of Object.entries(labels)) {
    if (excludeKeys.includes(field)) continue

    const importValue = importData[field]
    const existingValue = existingData[field]

    // 値が異なる場合のみ差分として追加
    if (JSON.stringify(importValue) !== JSON.stringify(existingValue)) {
      changes.push({
        field,
        fieldLabel: label,
        currentValue: existingValue,
        newValue: importValue,
      })
    }
  }

  return changes
}

/**
 * 日付を比較して新しい方を判定
 */
function isImportDataNewer(
  importUpdatedAt: string,
  existingUpdatedAt: string
): boolean {
  const importDate = new Date(importUpdatedAt)
  const existingDate = new Date(existingUpdatedAt)
  return importDate > existingDate
}

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

// =============================================================================
// 先生向けUI用のサマリー生成
// =============================================================================

/**
 * カテゴリ別の照合サマリーを生成（先生向けUI用）
 *
 * マッチング結果を以下のカテゴリに分類:
 * - autoMatched: 自動で紐づく（IDが完全一致 or データが同一）
 * - newItems: 新しく登録する（既存に該当なし）
 * - needsConfirmation: 確認が必要（マッチしたが差異あり）
 * - hasConflict: 問題あり（学籍番号重複など）
 */
export function createCategoryMatchingSummary<
  T extends Record<string, unknown> & { id: string; updatedAt?: string | Date },
>(
  results: MatchResult<T>[],
  category: ConflictCategory,
  labelGenerator: (data: T) => string,
  matchMethod: string
): CategoryMatchingSummary {
  const autoMatchedItems: Array<{ id: string; displayLabel: string }> = []
  const newItemsList: Array<{ id: string; displayLabel: string }> = []
  const confirmationItems: MatchingCandidate[] = []
  const conflictItems: MatchingCandidate[] = []

  for (const result of results) {
    const displayLabel = labelGenerator(result.importData)

    if (!result.existingData) {
      // 新規アイテム
      newItemsList.push({
        id: result.importData.id,
        displayLabel,
      })
    } else {
      // データに差異があるかチェック
      if (hasDataDifference(result.importData, result.existingData)) {
        // 差異がある場合は確認が必要
        const fieldChanges = calculateFieldChanges(
          result.importData,
          result.existingData,
          category
        )
        const importUpdatedAt = String(result.importData.updatedAt ?? "")
        const existingUpdatedAt = String(result.existingData.updatedAt ?? "")

        const candidate: MatchingCandidate = {
          id: `${category}-${result.importData.id}`,
          category,
          importData: result.importData,
          existingData: result.existingData,
          displayLabel,
          fieldChanges,
          isImportNewer: isImportDataNewer(importUpdatedAt, existingUpdatedAt),
          importUpdatedAt,
          existingUpdatedAt,
          matchReason: generateMatchReason(category, matchMethod),
        }

        confirmationItems.push(candidate)
      } else {
        // 差異なし - 自動で紐づく
        autoMatchedItems.push({
          id: result.importData.id,
          displayLabel,
        })
      }
    }
  }

  return {
    category,
    autoMatched: autoMatchedItems.length,
    newItems: newItemsList.length,
    needsConfirmation: confirmationItems.length,
    hasConflict: conflictItems.length,
    autoMatchedItems,
    newItemsList,
    confirmationItems,
    conflictItems,
  }
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
      (s) => `${s.lastName} ${s.firstName} (${s.studentNumber})`
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
      (c) => c.name
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
      (u) => `${u.name} (${u.username})`
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
      (sg) => sg.name
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

/**
 * 採点データの競合を検出
 *
 * 生徒と設問がマッチした上で、スコアに差異がある場合に競合として報告
 */
export async function detectScoreConflicts(
  importData: ExtractedArchiveData,
  _studentIdMapping: Record<string, string>,
  _cropRegionIdMapping: Record<string, string>
): Promise<CategoryMatchingResult[]> {
  const results: CategoryMatchingResult[] = []

  // TODO: QuestionScoreの競合検出
  // 既存のQuestionScoreを取得し、studentId + cropRegionIdでマッチング
  // 差異がある場合は競合として報告

  // QuestionScore (プレースホルダー)
  results.push({
    category: "QuestionScore",
    summary: {
      matched: 0,
      newItems: importData.scoresData.questionScores.length,
      conflicts: 0,
    },
    conflictItems: [],
    idMapping: {},
  })

  // DrawingAnnotation (プレースホルダー)
  results.push({
    category: "DrawingAnnotation",
    summary: {
      matched: 0,
      newItems: importData.scoresData.drawingAnnotations.length,
      conflicts: 0,
    },
    conflictItems: [],
    idMapping: {},
  })

  return results
}
