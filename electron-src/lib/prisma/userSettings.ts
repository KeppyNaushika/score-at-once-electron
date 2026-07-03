/**
 * @fileoverview ユーザー設定関連のPrisma操作関数
 * @description キーボードショートカット、ユーザー設定のDB操作を提供
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
  return shortcuts.reduce<Record<string, string>>((acc, shortcut) => {
    acc[shortcut.action] = shortcut.key
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
// UserPreference（KV方式ユーザー設定）
// =============================================================================

/**
 * ユーザー設定を取得（単一キー）
 * @param userId - ユーザーID
 * @param key - 設定キー
 * @returns 設定値（JSON文字列）。存在しない場合はnull
 */
export async function getUserPreference(
  userId: string,
  key: string
): Promise<string | null> {
  const record = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key } },
  })
  return record?.value ?? null
}

/**
 * ユーザー設定を保存（単一キー）
 * @param userId - ユーザーID
 * @param key - 設定キー
 * @param value - 設定値（JSON文字列）
 */
export async function setUserPreference(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value },
  })
}

/**
 * ユーザーの全設定を取得
 * @param userId - ユーザーID
 * @returns key -> value のマッピング
 */
export async function getUserPreferences(
  userId: string
): Promise<Record<string, string>> {
  const records = await prisma.userPreference.findMany({
    where: { userId },
  })
  return records.reduce<Record<string, string>>((acc, record) => {
    acc[record.key] = record.value
    return acc
  }, {})
}
