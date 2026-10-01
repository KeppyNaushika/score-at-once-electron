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
 * 割り当てを**1つだけ**追加/更新する。
 *
 * **直した1件しか書かない。** かつては画面が持っている割り当て全部（既定を重ねた
 * 全コマンド）をまとめて upsert していたが、それだと触っていない行の
 * `updatedAt` も進む。同期を入れると行ごとの勝ち負けが**組ごとの勝ち負け**に退化し、
 * 端末Aで `scoring.correct`、端末Bで `tool.text` を直すと、あとに保存した端末が
 * 全行の勝者になってもう片方の変更が消える。
 *
 * 1件だけ書けば、既定と同じままの割り当ては行を持たない。既定を変えたときに
 * 「保存済みの人には新しい既定が届かない」範囲も、実際に触った割り当てだけで済む。
 * 全部を書いていた頃に焼き込まれた行は、マイグレーション 20261002120000 が片付けた。
 *
 * @param userId - ユーザーID
 * @param action - コマンドID（`scoring.correct` など）
 * @param key - 割り当てるキー（押す側と同じ綴り）
 */
export async function setUserKeyboardShortcut(
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
