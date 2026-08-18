/**
 * 設定関連のIPCハンドラー
 */

import { BrowserWindow, powerSaveBlocker } from "electron"

import type { IndividualReportOptions } from "@/types/individualReport.types"

import type {
  AnswerOverlayStyle,
  AnswerOverlayVisibility,
} from "../../src/types/scoringOverlay.types"
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
  bulkUpsertUserKeyboardShortcuts,
  getUserKeyboardShortcuts,
  getUserPreference,
  resetUserKeyboardShortcuts,
  setUserPreference,
} from "../lib/prisma/userSettings"
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

  // 書き込み系は件数を返さない。呼び出し側が使っておらず、返すと契約に
  // 意味の無い型が乗る
  "settings:saveUserKeyboardShortcuts": async (
    userId: string,
    shortcuts: Record<string, string>
  ) => {
    await bulkUpsertUserKeyboardShortcuts(userId, shortcuts)
  },

  "settings:resetUserKeyboardShortcuts": async (userId: string) => {
    await resetUserKeyboardShortcuts(userId)
  },

  // =========================================================================
  // UserPreference（KV方式）
  // =========================================================================

  "settings:getUserPreference": (userId: string, key: string) =>
    getUserPreference(userId, key),

  "settings:setUserPreference": (userId: string, key: string, value: string) =>
    setUserPreference(userId, key, value),

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
