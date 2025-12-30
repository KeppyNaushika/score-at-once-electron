/**
 * 競合解決モジュール
 *
 * 競合ポリシーに基づいて解決方法を決定
 */

import type {
  ConflictItem,
  ConflictResolutions,
  ConflictCategory,
  CategoryConflictResolution,
} from "../../../../types/projectArchive.types"

/**
 * 解決結果
 */
export type Resolution = "import" | "existing" | "skip"

/**
 * 解決済みの競合
 */
export interface ResolvedConflict {
  item: ConflictItem
  resolution: Resolution
}

/**
 * タイムスタンプを比較して新しい方を選択
 */
function compareTimestamps(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown>
): Resolution {
  const importUpdatedAt = importData.updatedAt
  const existingUpdatedAt = existingData.updatedAt

  if (!importUpdatedAt || !existingUpdatedAt) {
    // タイムスタンプがない場合はインポートを優先
    return "import"
  }

  const importTime = new Date(importUpdatedAt as string).getTime()
  const existingTime = new Date(existingUpdatedAt as string).getTime()

  return importTime > existingTime ? "import" : "existing"
}

/**
 * 単一の競合を解決
 */
export function resolveConflict(
  item: ConflictItem,
  categoryResolution: CategoryConflictResolution | undefined
): Resolution {
  if (!categoryResolution) {
    // デフォルトはタイムスタンプ比較
    return compareTimestamps(item.importData, item.existingData)
  }

  // 手動解決が指定されている場合
  if (
    categoryResolution.policy === "manual" &&
    categoryResolution.manualResolutions
  ) {
    const manualResolution = categoryResolution.manualResolutions[item.id]
    if (manualResolution) {
      return manualResolution
    }
    // 手動解決が指定されていない場合はスキップ
    return "skip"
  }

  // ポリシーに基づいて解決
  switch (categoryResolution.policy) {
    case "import_wins":
      return "import"
    case "existing_wins":
      return "existing"
    case "timestamp":
      return compareTimestamps(item.importData, item.existingData)
    case "manual":
      // ここには来ないはず
      return "skip"
    default:
      // デフォルトはタイムスタンプ比較
      return compareTimestamps(item.importData, item.existingData)
  }
}

/**
 * 全ての競合を解決
 */
export function resolveAllConflicts(
  conflicts: ConflictItem[],
  resolutions: ConflictResolutions
): ResolvedConflict[] {
  const resolved: ResolvedConflict[] = []

  for (const item of conflicts) {
    const categoryResolution = resolutions[item.category]
    const resolution = resolveConflict(item, categoryResolution)

    resolved.push({
      item,
      resolution,
    })
  }

  return resolved
}

/**
 * カテゴリ別に競合を解決
 */
export function resolveCategoryConflicts(
  category: ConflictCategory,
  conflicts: ConflictItem[],
  resolution: CategoryConflictResolution | undefined
): ResolvedConflict[] {
  return conflicts
    .filter((c) => c.category === category)
    .map((item) => ({
      item,
      resolution: resolveConflict(item, resolution),
    }))
}

/**
 * デフォルトの競合解決設定を生成
 */
export function createDefaultResolutions(): ConflictResolutions {
  return {
    Student: { policy: "timestamp" },
    Class: { policy: "timestamp" },
    User: { policy: "existing_wins" }, // ユーザーは既存を優先
    SubtotalGroup: { policy: "timestamp" },
    QuestionScore: { policy: "timestamp" },
    DrawingAnnotation: { policy: "timestamp" },
  }
}

/**
 * 解決結果の統計を計算
 */
export function calculateResolutionStats(resolved: ResolvedConflict[]): {
  importWins: number
  existingWins: number
  skipped: number
  total: number
} {
  let importWins = 0
  let existingWins = 0
  let skipped = 0

  for (const r of resolved) {
    switch (r.resolution) {
      case "import":
        importWins++
        break
      case "existing":
        existingWins++
        break
      case "skip":
        skipped++
        break
    }
  }

  return {
    importWins,
    existingWins,
    skipped,
    total: resolved.length,
  }
}
