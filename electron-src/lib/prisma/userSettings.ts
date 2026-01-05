/**
 * @fileoverview ユーザー設定関連のPrisma操作関数
 * @description キーボードショートカット、採点画面設定のDB操作を提供
 */

import prisma from "./client"

// =============================================================================
// UserKeyboardShortcut（キーボードショートカット）
// =============================================================================

/**
 * ユーザーのキーボードショートカット設定を取得
 * @param userId - ユーザーID
 * @returns action -> key のマッピングオブジェクト
 */
export async function getUserKeyboardShortcuts(userId: string) {
  const shortcuts = await prisma.userKeyboardShortcut.findMany({
    where: { userId },
  })
  // action -> key のマッピングに変換
  return shortcuts.reduce<Record<string, string>>((acc, s) => {
    acc[s.action] = s.key
    return acc
  }, {})
}

/**
 * キーボードショートカットを追加/更新
 * @param userId - ユーザーID
 * @param action - アクション名
 * @param key - 割り当てるキー
 */
export async function upsertUserKeyboardShortcut(
  userId: string,
  action: string,
  key: string
) {
  return prisma.userKeyboardShortcut.upsert({
    where: {
      userId_action: { userId, action },
    },
    update: { key },
    create: { userId, action, key },
  })
}

/**
 * 複数のキーボードショートカットを一括で追加/更新
 * @param userId - ユーザーID
 * @param shortcuts - action -> key のマッピング
 */
export async function bulkUpsertUserKeyboardShortcuts(
  userId: string,
  shortcuts: Record<string, string>
) {
  const operations = Object.entries(shortcuts).map(([action, key]) =>
    prisma.userKeyboardShortcut.upsert({
      where: {
        userId_action: { userId, action },
      },
      update: { key },
      create: { userId, action, key },
    })
  )
  return prisma.$transaction(operations)
}

/**
 * キーボードショートカットを削除
 * @param userId - ユーザーID
 * @param action - 削除するアクション名
 */
export async function deleteUserKeyboardShortcut(
  userId: string,
  action: string
) {
  return prisma.userKeyboardShortcut.deleteMany({
    where: { userId, action },
  })
}

/**
 * ユーザーのキーボードショートカット設定を全てリセット
 * @param userId - ユーザーID
 */
export async function resetUserKeyboardShortcuts(userId: string) {
  return prisma.userKeyboardShortcut.deleteMany({
    where: { userId },
  })
}

// =============================================================================
// UserScoringPreference（採点画面設定）
// =============================================================================

/** 採点設定の更新用データ型（全カラムオプショナル） */
export interface ScoringPreferenceData {
  showStudentNames?: boolean
  autoScroll?: boolean
  itemsPerLine?: number
  layoutDirection?: string
  expandMargin?: number
  selectionBorderColor?: string | null
  scoringStatusColors?: string | null
  scoringColorPresetId?: string | null
}

/**
 * カラム別の型定義
 */
export interface ScoringPreferenceColumns {
  showStudentNames: boolean
  autoScroll: boolean
  itemsPerLine: number
  layoutDirection: string
  expandMargin: number
  selectionBorderColor: string | null
  scoringStatusColors: string | null
  scoringColorPresetId: string | null
}

export type ScoringPreferenceColumnName = keyof ScoringPreferenceColumns

/**
 * ユーザーの採点設定レコードを取得
 * @param userId - ユーザーID
 * @returns 採点設定レコード（存在しない場合はnull）
 */
export async function getUserScoringPreference(userId: string) {
  return prisma.userScoringPreference.findUnique({
    where: { userId },
  })
}

/**
 * 採点設定をまとめて追加/更新（レコード単位）
 * @param userId - ユーザーID
 * @param data - 更新する設定データ
 */
export async function upsertUserScoringPreference(
  userId: string,
  data: ScoringPreferenceData
) {
  return prisma.userScoringPreference.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      showStudentNames: data.showStudentNames ?? true,
      autoScroll: data.autoScroll ?? true,
      itemsPerLine: data.itemsPerLine ?? 5,
      layoutDirection: data.layoutDirection ?? "right-down",
      expandMargin: data.expandMargin ?? 0,
      selectionBorderColor: data.selectionBorderColor ?? null,
      scoringStatusColors: data.scoringStatusColors ?? null,
      scoringColorPresetId: data.scoringColorPresetId ?? null,
    },
  })
}

// =============================================================================
// カラム別操作（楽観的更新対応）
// =============================================================================

/** 採点設定のデフォルト値 */
const SCORING_PREFERENCE_DEFAULTS: ScoringPreferenceColumns = {
  showStudentNames: true,
  autoScroll: true,
  itemsPerLine: 5,
  layoutDirection: "right-down",
  expandMargin: 0,
  selectionBorderColor: null,
  scoringStatusColors: null,
  scoringColorPresetId: null,
}

/**
 * 指定したカラムの値を取得
 */
export async function getScoringPreferenceColumn<
  K extends ScoringPreferenceColumnName,
>(userId: string, column: K): Promise<ScoringPreferenceColumns[K]> {
  const record = await prisma.userScoringPreference.findUnique({
    where: { userId },
    select: { [column]: true },
  })

  if (!record) {
    return SCORING_PREFERENCE_DEFAULTS[column]
  }

  // Prismaのselect結果から値を取得
  return (record as unknown as ScoringPreferenceColumns)[column]
}

/**
 * 指定したカラムの値を設定（楽観的更新用 - 単一カラムのみ更新）
 */
export async function setScoringPreferenceColumn<
  K extends ScoringPreferenceColumnName,
>(
  userId: string,
  column: K,
  value: ScoringPreferenceColumns[K]
): Promise<void> {
  await prisma.userScoringPreference.upsert({
    where: { userId },
    update: { [column]: value },
    create: {
      userId,
      ...SCORING_PREFERENCE_DEFAULTS,
      [column]: value,
    },
  })
}
