/**
 * 設定関連のIPCハンドラー
 */

import { BrowserWindow, powerSaveBlocker } from "electron"

import type { IndividualReportOptions } from "@/types/individualReport.types"

import type {
  AnswerOverlayStyle,
  AnswerOverlayVisibility,
} from "../../src/types/scoringOverlay.types"
import { getAppPreference, setAppPreference } from "../lib/prisma/appPreference"
import type {
  ExamReportGraphSettingsValues,
  ExamReportTableSectionValues,
} from "../lib/prisma/examSettings"
import {
  getExamExportSettings,
  setExamAnswerOverlayStyle,
  setExamAnswerOverlayVisibility,
  setExamReportGraphSettings,
  setExamReportSettings,
  setExamReportStatisticVisibility,
  setExamReportTableSection,
} from "../lib/prisma/examSettings"
import {
  listUserClickScoringActions,
  setUserClickScoringAction,
} from "../lib/prisma/userClickScoringAction"
import type { UserScoringStatusColorValues } from "../lib/prisma/userScoringStatusColor"
import {
  applyUserScoringColorPreset,
  listUserScoringStatusColors,
  setUserScoringStatusColor,
} from "../lib/prisma/userScoringStatusColor"
import {
  getUserKeyboardShortcuts,
  getUserPreference,
  resetUserKeyboardShortcuts,
  setUserKeyboardShortcut,
  setUserPreference,
} from "../lib/prisma/userSettings"
import {
  listUserSidePanelSections,
  setUserSidePanelSection,
} from "../lib/prisma/userSidePanelSection"
import { type HandlerMap, withEvent } from "./ipcHandlerUtils"

// プロジェクターモード用のpowerSaveBlocker ID
let projectorModeBlockerId: number | null = null

/** 設定（キーボードショートカット・採点マーク書式・表示設定・プロジェクターモード等）に関するIPCチャンネルを登録する */
export const settingsHandlers = {
  // =========================================================================
  // プロジェクターモード（スクリーンセーバー無効化）
  // =========================================================================

  "settings:setProjectorMode": async (enabled: boolean) => {
    const isBlocking =
      projectorModeBlockerId !== null &&
      powerSaveBlocker.isStarted(projectorModeBlockerId)

    if (enabled) {
      if (!isBlocking) {
        projectorModeBlockerId = powerSaveBlocker.start("prevent-display-sleep")
      }
      return true
    }

    if (isBlocking) {
      powerSaveBlocker.stop(projectorModeBlockerId!)
    }
    projectorModeBlockerId = null
    return false
  },

  "settings:getProjectorMode": async () =>
    projectorModeBlockerId !== null &&
    powerSaveBlocker.isStarted(projectorModeBlockerId),

  // =========================================================================
  // フルスクリーン制御（event.sender からウィンドウを取るため event が要る）
  // =========================================================================

  "settings:getFullScreen": withEvent(
    async (event) =>
      BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  ),

  "settings:setFullScreen": withEvent(async (event, enabled: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setFullScreen(enabled)
  }),

  // =========================================================================
  // UserKeyboardShortcut
  // =========================================================================

  "settings:getUserKeyboardShortcuts": (userId: string) =>
    getUserKeyboardShortcuts(userId),

  // 書き込みは**割り当て1つにつき1回**。まとめて送ると触っていない行の updatedAt も
  // 進み、同期で行ごとの勝ち負けが組ごとの勝ち負けに退化する。
  //
  // 書き込み系は結果を返さない。呼び出し側が使っておらず、返すと契約に
  // 意味の無い型が乗る
  "settings:setUserKeyboardShortcut": async (
    userId: string,
    action: string,
    key: string
  ) => {
    await setUserKeyboardShortcut(userId, action, key)
  },

  "settings:resetUserKeyboardShortcuts": async (userId: string) => {
    await resetUserKeyboardShortcuts(userId)
  },

  // =========================================================================
  // AppPreference（KV方式・全員で同じ値）
  // =========================================================================

  "settings:getAppPreference": (key: string) => getAppPreference(key),

  "settings:setAppPreference": (key: string, value: string) =>
    setAppPreference(key, value),

  // =========================================================================
  // UserPreference（KV方式）
  // =========================================================================

  "settings:getUserPreference": (userId: string, key: string) =>
    getUserPreference(userId, key),

  "settings:setUserPreference": (userId: string, key: string, value: string) =>
    setUserPreference(userId, key, value),

  // =========================================================================
  // 利用者ごとの設定のうち、**組が繰り返すもの**は行で持つ。
  // 1キーの JSON に畳んでいた頃は、続けて2つ変えると先の1つが消えていた
  // （塊で読み書きするので、取り直しの前に古い写しを重ねて書く）
  // =========================================================================

  "settings:listUserScoringStatusColors": (userId: string) =>
    listUserScoringStatusColors(userId),

  "settings:setUserScoringStatusColor": (
    userId: string,
    status: string,
    colors: UserScoringStatusColorValues
  ) => setUserScoringStatusColor(userId, status, colors),

  // プリセットは**土台の id だけ**を預かる。色の中身は画面側が持つ
  "settings:applyUserScoringColorPreset": (userId: string, presetId: string) =>
    applyUserScoringColorPreset(userId, presetId),

  "settings:listUserClickScoringActions": (userId: string) =>
    listUserClickScoringActions(userId),

  "settings:setUserClickScoringAction": (
    userId: string,
    clickCount: number,
    action: string
  ) => setUserClickScoringAction(userId, clickCount, action),

  "settings:listUserSidePanelSections": (userId: string) =>
    listUserSidePanelSections(userId),

  "settings:setUserSidePanelSection": (
    userId: string,
    sectionId: string,
    collapsed: boolean
  ) => setUserSidePanelSection(userId, sectionId, collapsed),

  // =========================================================================
  // ExamExportSettings
  // =========================================================================

  "settings:getExamExportSettings": (examId: string) =>
    getExamExportSettings(examId),

  // 出力設定の書き込みは1つにつき1レコード。何を変えたかは操作が知っている
  "settings:setExamAnswerOverlayStyle": (
    examId: string,
    style: AnswerOverlayStyle
  ) => setExamAnswerOverlayStyle(examId, style),

  "settings:setExamAnswerOverlayVisibility": (
    examId: string,
    visibility: AnswerOverlayVisibility
  ) => setExamAnswerOverlayVisibility(examId, visibility),

  "settings:setExamReportStatisticVisibility": (
    examId: string,
    statisticKind: string,
    scope: string,
    shown: boolean
  ) => setExamReportStatisticVisibility(examId, statisticKind, scope, shown),

  "settings:setExamReportSettings": (
    examId: string,
    individualReport: IndividualReportOptions
  ) => setExamReportSettings(examId, individualReport),

  "settings:setExamReportTableSection": (
    examId: string,
    tableKind: string,
    values: ExamReportTableSectionValues
  ) => setExamReportTableSection(examId, tableKind, values),

  "settings:setExamReportGraphSettings": (
    examId: string,
    values: ExamReportGraphSettingsValues
  ) => setExamReportGraphSettings(examId, values),
} satisfies HandlerMap
