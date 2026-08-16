import { queryOptions } from "@tanstack/react-query"

import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { serializePreference } from "@/lib/userPreferences"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 設定（`UserPreference` / キーバインディング / 表示モード / 試験の出力設定）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/settingsApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/**
 * KV方式のユーザー設定を1キー分。
 *
 * **保存されている文字列をそのまま返す。** 値の解釈（`parsePreference`）は
 * 表示側の計算なので、キャッシュには載せない。
 */
export const userPreferenceQuery = (
  userId: string | undefined,
  key: PreferenceKey
) =>
  queryOptions({
    queryKey: ["userPreference", userId, key] as const,
    queryFn: () =>
      window.electronAPI.settings.getUserPreference(userId ?? "", key),
  })

/** 利用者ごとのキーバインディング */
export const keyboardShortcutsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["settings", "keyboardShortcuts", userId] as const,
    queryFn: () =>
      window.electronAPI.settings.getUserKeyboardShortcuts(userId ?? ""),
  })

/** main が持つプロジェクターモードの現在状態 */
export const projectorModeQuery = () =>
  queryOptions({
    queryKey: ["settings", "projectorMode"] as const,
    queryFn: () => window.electronAPI.settings.getProjectorMode(),
  })

/** 試験ごとの出力設定（重ね描き・個人成績表） */
export const examExportSettingsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "exportSettings"] as const,
    queryFn: () => window.electronAPI.settings.getExamExportSettings(examId),
  })

// =====================================================================
// 書き込み
// =====================================================================

/**
 * ユーザー設定を1キー分書く。
 *
 * **値は型のまま渡す。** 保存文字列への変換をここが持つので、読む側の
 * `parsePreference` と段数が食い違わない。呼び出し側が個別に `JSON.stringify`
 * していた頃は、同じキーへ2つの符号化が書かれて保存済みの値が読めなくなった。
 */
type SetUserPreferenceInput = {
  [TKey in PreferenceKey]: { key: TKey; value: PreferenceValueType[TKey] }
}[PreferenceKey]

export const setUserPreferenceMutation = (userId: string | undefined) =>
  defineMutation({
    mutationFn: (input: SetUserPreferenceInput) =>
      window.electronAPI.settings.setUserPreference(
        userId ?? "",
        input.key,
        serializePreference(input.key, input.value)
      ),
    scope: { id: `userPreference:${userId}` },
    meta: {
      invalidates: [["userPreference", userId]],
      errorMessage: "設定を保存できませんでした",
    },
  })

export const saveKeyboardShortcutsMutation = (userId: string | undefined) =>
  defineMutation({
    mutationFn: (
      shortcuts: Parameters<
        typeof window.electronAPI.settings.saveUserKeyboardShortcuts
      >[1]
    ) =>
      window.electronAPI.settings.saveUserKeyboardShortcuts(
        userId ?? "",
        shortcuts
      ),
    meta: {
      invalidates: [keyboardShortcutsQuery(userId).queryKey],
      errorMessage: "キー設定を保存できませんでした",
    },
  })

export const resetKeyboardShortcutsMutation = (userId: string | undefined) =>
  defineMutation({
    mutationFn: () =>
      window.electronAPI.settings.resetUserKeyboardShortcuts(userId ?? ""),
    meta: {
      invalidates: [keyboardShortcutsQuery(userId).queryKey],
      errorMessage: "キー設定を戻せませんでした",
    },
  })

export const saveExamExportSettingsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      settings: Parameters<
        typeof window.electronAPI.settings.saveExamExportSettings
      >[1]
    ) => window.electronAPI.settings.saveExamExportSettings(examId, settings),
    scope: { id: `exam:${examId}:exportSettings` },
    meta: {
      invalidates: [examExportSettingsQuery(examId).queryKey],
      errorMessage: "出力設定を保存できませんでした",
    },
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

/**
 * 今この窓が全画面かどうか。
 *
 * main のウィンドウ状態なので、キャッシュに置いても他所から動かされる。読むときに
 * その場で引く（`queryClient.fetchQuery`）用途で、購読はしない。
 */
export const fullScreenQuery = () =>
  queryOptions({
    queryKey: ["settings", "fullScreen"] as const,
    queryFn: () => window.electronAPI.settings.getFullScreen(),
    staleTime: 0,
    gcTime: 0,
  })

/** プロジェクターモードは main のウィンドウ状態。DB には残らない */
export const setProjectorModeMutation = () =>
  defineMutation({
    mutationFn: (enabled: boolean) =>
      window.electronAPI.settings.setProjectorMode(enabled),
    meta: {
      writesDatabase: false,
      errorMessage: "プロジェクターモードを切り替えられませんでした",
    },
  })

export const setFullScreenMutation = () =>
  defineMutation({
    mutationFn: (enabled: boolean) =>
      window.electronAPI.settings.setFullScreen(enabled),
    meta: {
      writesDatabase: false,
      errorMessage: "全画面表示を切り替えられませんでした",
    },
  })
