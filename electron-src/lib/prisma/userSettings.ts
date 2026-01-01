/**
 * ユーザー設定関連のPrisma操作関数
 */

import prisma from "./client"

// =============================================================================
// UserKeyboardShortcut（キーボードショートカット）
// =============================================================================

export async function getUserKeyboardShortcuts(userId: string) {
  const shortcuts = await prisma.userKeyboardShortcut.findMany({
    where: { userId },
  })
  // action -> key のマッピングに変換
  return shortcuts.reduce<Record<string, string>>(
    (acc, s) => {
      acc[s.action] = s.key
      return acc
    },
    {}
  )
}

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

export async function deleteUserKeyboardShortcut(userId: string, action: string) {
  return prisma.userKeyboardShortcut.deleteMany({
    where: { userId, action },
  })
}

export async function resetUserKeyboardShortcuts(userId: string) {
  return prisma.userKeyboardShortcut.deleteMany({
    where: { userId },
  })
}

// =============================================================================
// UserScoringPreference（採点画面設定）
// =============================================================================

export interface ScoringPreferenceData {
  showStudentNames?: boolean
  autoScroll?: boolean
  itemsPerLine?: number
  layoutDirection?: string
  selectionBorderColor?: string | null
  scoringStatusColors?: string | null
  scoringColorPresetId?: string | null
}

export async function getUserScoringPreference(userId: string) {
  return prisma.userScoringPreference.findUnique({
    where: { userId },
  })
}

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
      selectionBorderColor: data.selectionBorderColor ?? null,
      scoringStatusColors: data.scoringStatusColors ?? null,
      scoringColorPresetId: data.scoringColorPresetId ?? null,
    },
  })
}
