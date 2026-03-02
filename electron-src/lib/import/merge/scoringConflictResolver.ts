/**
 * 採点結果の競合解決
 */

import type {
  ScoringConflict,
  ScoringConflictConfig,
  ScoringConflictResolutionStrategy,
} from "../../../../types/examArchive.types"

/**
 * 採点結果の競合を解決
 *
 * @param conflict - 競合データ
 * @param config - 競合解決設定
 * @returns "import"（インポートデータを使用）または "existing"（既存データを維持）
 */
export function resolveScoringConflict(
  conflict: ScoringConflict,
  config?: ScoringConflictConfig
): "import" | "existing" {
  // デフォルト: newer_wins
  const strategy: ScoringConflictResolutionStrategy =
    config?.strategy ?? "newer_wins"

  switch (strategy) {
    case "import_wins":
      // すべてファイルの採点を使う
      return "import"

    case "existing_wins":
      // すべてこのPCの採点を使う
      return "existing"

    case "newer_wins": {
      // 新しい方（最終更新日時）を使う
      return resolveByTimestamp(conflict)
    }

    case "manual": {
      // 競合している採点を1つずつ確認する
      // manualResolutionsから個別の解決を取得
      const manualResolution =
        config?.manualResolutions?.[conflict.importScoreId]
      if (manualResolution) {
        return manualResolution
      }
      // 未設定の場合はデフォルトでnewer_winsと同じ動作
      return resolveByTimestamp(conflict)
    }

    default:
      // デフォルト: newer_wins
      return resolveByTimestamp(conflict)
  }
}

/**
 * 更新日時に基づいて競合を解決
 */
function resolveByTimestamp(conflict: ScoringConflict): "import" | "existing" {
  const importDate = new Date(conflict.importScore.updatedAt)
  const existingDate = new Date(conflict.existingScore.updatedAt)
  return importDate > existingDate ? "import" : "existing"
}
