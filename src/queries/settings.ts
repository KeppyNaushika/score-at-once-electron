import { queryOptions } from "@tanstack/react-query"

import type {
  ExamReportGraphSettingsValues,
  ExamReportTableSectionValues,
} from "@/electron-src/lib/prisma/examSettings"
import type {
  UserScoringStatusColorEntry,
  UserScoringStatusColorValues,
} from "@/electron-src/lib/prisma/userScoringStatusColor"
import type { PreferenceKey, PreferenceValueType } from "@/lib/userPreferences"
import { serializePreference } from "@/lib/userPreferences"
import type { ClickScoringAction } from "@/types/clickScoring.types"
import type { IndividualReportOptions } from "@/types/individualReport.types"
import type {
  AnswerOverlayStyle,
  AnswerOverlayVisibility,
} from "@/types/scoringOverlay.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

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
export const userPreferenceQuery = (userId: string, key: PreferenceKey) =>
  queryOptions({
    queryKey: ["userPreference", userId, key] as const,
    queryFn: () => window.electronAPI.settings.getUserPreference(userId, key),
  })

/**
 * 採点状態ごとの表示色（利用者ごと・状態ごとに1行）。
 *
 * **行をそのまま載せる。** 状態で引ける形へ畳むのは表示側の計算で、`select` が行う
 * （キャッシュには載らない）。行が無い状態は既定の配色で描く。
 */
export const userScoringStatusColorsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["userScoringStatusColor", userId] as const,
    queryFn: () =>
      window.electronAPI.settings.listUserScoringStatusColors(userId),
  })

/** 連続クリックでの採点に割り当てた動作（利用者ごと・回数ごとに1行） */
export const userClickScoringActionsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["userClickScoringAction", userId] as const,
    queryFn: () =>
      window.electronAPI.settings.listUserClickScoringActions(userId),
  })

/** 側面パネルで畳んでいる節（利用者ごと・節ごとに1行） */
export const userSidePanelSectionsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["userSidePanelSection", userId] as const,
    queryFn: () =>
      window.electronAPI.settings.listUserSidePanelSections(userId),
  })

/** 利用者ごとのキーバインディング */
export const keyboardShortcutsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["settings", "keyboardShortcuts", userId] as const,
    queryFn: () => window.electronAPI.settings.getUserKeyboardShortcuts(userId),
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
export type SetUserPreferenceInput = {
  [TKey in PreferenceKey]: { key: TKey; value: PreferenceValueType[TKey] }
}[PreferenceKey]

export const setUserPreferenceMutation = (userId: string) =>
  defineMutation({
    mutationFn: (input: SetUserPreferenceInput) =>
      window.electronAPI.settings.setUserPreference(
        userId,
        input.key,
        serializePreference(input.key, input.value)
      ),
    scope: { id: `userPreference:${userId}` },
    meta: {
      invalidates: [["userPreference", userId]],
      errorMessage: "設定を保存できませんでした",
    },
  })

/**
 * 採点状態1つぶんの色を書く。
 *
 * **プリセットの記憶も外れる**（色を1つでも触ればプリセットからは外れるので、DB では
 * 同じトランザクションで消している）。取り直す先が2つあるのはそのため。
 */
export const setUserScoringStatusColorMutation = (userId: string) =>
  defineMutation({
    mutationFn: (input: {
      status: ScoringStatus
      colors: UserScoringStatusColorValues
    }) =>
      window.electronAPI.settings.setUserScoringStatusColor(
        userId,
        input.status,
        input.colors
      ),
    scope: { id: `userScoringStatusColor:${userId}` },
    meta: {
      invalidates: [
        userScoringStatusColorsQuery(userId).queryKey,
        ["userPreference", userId],
      ],
      errorMessage: "色を保存できませんでした",
    },
  })

/** 配色プリセットを当てる（状態ぶんの色と、選んだプリセットは同時に決まる） */
export const applyUserScoringColorPresetMutation = (userId: string) =>
  defineMutation({
    mutationFn: (input: {
      presetId: string
      colors: UserScoringStatusColorEntry[]
    }) =>
      window.electronAPI.settings.applyUserScoringColorPreset(
        userId,
        input.presetId,
        input.colors
      ),
    scope: { id: `userScoringStatusColor:${userId}` },
    meta: {
      invalidates: [
        userScoringStatusColorsQuery(userId).queryKey,
        ["userPreference", userId],
      ],
      errorMessage: "配色を保存できませんでした",
    },
  })

/** クリック回数1つぶんの動作を書く */
export const setUserClickScoringActionMutation = (userId: string) =>
  defineMutation({
    mutationFn: (input: { clickCount: number; action: ClickScoringAction }) =>
      window.electronAPI.settings.setUserClickScoringAction(
        userId,
        input.clickCount,
        input.action
      ),
    scope: { id: `userClickScoringAction:${userId}` },
    meta: {
      invalidates: [userClickScoringActionsQuery(userId).queryKey],
      errorMessage: "クリック採点の設定を保存できませんでした",
    },
  })

/** 側面パネルの節1つぶんの開閉を書く */
export const setUserSidePanelSectionMutation = (userId: string) =>
  defineMutation({
    mutationFn: (input: { sectionId: string; collapsed: boolean }) =>
      window.electronAPI.settings.setUserSidePanelSection(
        userId,
        input.sectionId,
        input.collapsed
      ),
    scope: { id: `userSidePanelSection:${userId}` },
    meta: {
      invalidates: [userSidePanelSectionsQuery(userId).queryKey],
      errorMessage: "パネルの開閉を保存できませんでした",
    },
  })

export const saveKeyboardShortcutsMutation = (userId: string) =>
  defineMutation({
    mutationFn: (
      shortcuts: Parameters<
        typeof window.electronAPI.settings.saveUserKeyboardShortcuts
      >[1]
    ) =>
      window.electronAPI.settings.saveUserKeyboardShortcuts(userId, shortcuts),
    meta: {
      invalidates: [keyboardShortcutsQuery(userId).queryKey],
      errorMessage: "キー設定を保存できませんでした",
    },
  })

export const resetKeyboardShortcutsMutation = (userId: string) =>
  defineMutation({
    mutationFn: () =>
      window.electronAPI.settings.resetUserKeyboardShortcuts(userId),
    meta: {
      invalidates: [keyboardShortcutsQuery(userId).queryKey],
      errorMessage: "キー設定を戻せませんでした",
    },
  })

/**
 * 出力設定の書き込みは**1つにつき1レコード**。
 *
 * 6つのテーブルに分かれているので、口も6つに分かれる。どれも同じ `scope` を
 * 名乗るので実行は直列になり、取り直しは最後の1件だけが走る。
 */
const exportSettingsWrite = (examId: string) =>
  ({
    scope: { id: `exam:${examId}:exportSettings` },
    meta: {
      invalidates: [examExportSettingsQuery(examId).queryKey],
      errorMessage: "出力設定を保存できませんでした",
    },
  }) as const

/** 重ね描きのスタイルを1種別ぶん */
export const setExamAnswerOverlayStyleMutation = (examId: string) =>
  defineMutation({
    mutationFn: (style: AnswerOverlayStyle) =>
      window.electronAPI.settings.setExamAnswerOverlayStyle(examId, style),
    ...exportSettingsWrite(examId),
  })

/** 採点状態1つぶんの可視性 */
export const setExamAnswerOverlayVisibilityMutation = (examId: string) =>
  defineMutation({
    mutationFn: (visibility: AnswerOverlayVisibility) =>
      window.electronAPI.settings.setExamAnswerOverlayVisibility(
        examId,
        visibility
      ),
    ...exportSettingsWrite(examId),
  })

/** 統計の可視性を、種別×母集団の1マスぶん */
export const setExamReportStatisticVisibilityMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      statisticKind: string
      scope: string
      shown: boolean
    }) =>
      window.electronAPI.settings.setExamReportStatisticVisibility(
        examId,
        input.statisticKind,
        input.scope,
        input.shown
      ),
    ...exportSettingsWrite(examId),
  })

/**
 * 個人成績表の設定本体（1試験に1行）。
 *
 * この行だけは十数個のオプションから組む射影が要る。読み出しと対なので main が
 * 持ち、ここはオプションをそのまま渡す。
 */
export const setExamReportSettingsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (individualReport: IndividualReportOptions) =>
      window.electronAPI.settings.setExamReportSettings(
        examId,
        individualReport
      ),
    ...exportSettingsWrite(examId),
  })

/** 個人成績表の表の節（小計・設問）を1つぶん */
export const setExamReportTableSectionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      tableKind: string
      values: ExamReportTableSectionValues
    }) =>
      window.electronAPI.settings.setExamReportTableSection(
        examId,
        input.tableKind,
        input.values
      ),
    ...exportSettingsWrite(examId),
  })

/** 個人成績表のグラフ設定（1試験に1行） */
export const setExamReportGraphSettingsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (values: ExamReportGraphSettingsValues) =>
      window.electronAPI.settings.setExamReportGraphSettings(examId, values),
    ...exportSettingsWrite(examId),
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
