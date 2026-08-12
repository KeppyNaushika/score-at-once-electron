/**
 * IPC チャンネルの登録簿。
 *
 * チャンネル名 → 実装の対応をここ1箇所に集める。preload はこの `Handlers` から
 * 引数と戻り値の型を導くので、**renderer 側で契約を宣言し直す必要がない**
 * （renderer 側の手書き契約はこの仕組みで不要になり、削除済み）。
 *
 * 前提: main と renderer が同じ TypeScript プログラムに属していること。
 * `electron-src` を別ビルドへ切り出すとこの導出は成立しない。
 */

import { answerSheetBuilderHandlers } from "./answerSheetBuilderHandlers"
import { archiveHandlers } from "./archiveHandlers"
import { auditLogHandlers } from "./auditLogHandlers"
import { authHandlers } from "./authHandlers"
import { courseworkHandlers } from "./courseworkHandlers"
import { cropRegionHandlers } from "./cropRegionHandlers"
import { drawingHandlers } from "./drawingHandlers"
import { examClassroomHandlers } from "./examClassroomHandlers"
import { examHandlers } from "./examHandlers"
import { exportHandlers } from "./exportHandlers"
import { gradeHandlers } from "./gradeHandlers"
import { registerChannel } from "./ipcHandlerUtils"
import { miscHandlers } from "./miscHandlers"
import { navigationHandlers } from "./navigationHandlers"
import { omrConfigHandlers } from "./omrConfigHandlers"
import { omrHandlers } from "./omrHandlers"
import { pdfToolsHandlers } from "./pdfToolsHandlers"
import { scoringHandlers } from "./scoringHandlers"
import { settingsHandlers } from "./settingsHandlers"
import { studentArchiveHandlers } from "./studentArchiveHandlers"
import { studentHandlers } from "./studentHandlers"
import { subtotalGroupHandlers } from "./subtotalGroupHandlers"
import { syncHandlers } from "./syncHandlers"
import { tagHandlers } from "./tagHandlers"
import { userExamHandlers } from "./userExamHandlers"

/** ドメインごとの登録簿。件数の照合（＝チャンネル名の衝突検出）に使う */
const handlerGroups = [
  answerSheetBuilderHandlers,
  archiveHandlers,
  auditLogHandlers,
  authHandlers,
  courseworkHandlers,
  cropRegionHandlers,
  drawingHandlers,
  examClassroomHandlers,
  examHandlers,
  exportHandlers,
  gradeHandlers,
  miscHandlers,
  navigationHandlers,
  omrConfigHandlers,
  omrHandlers,
  pdfToolsHandlers,
  scoringHandlers,
  settingsHandlers,
  studentArchiveHandlers,
  studentHandlers,
  subtotalGroupHandlers,
  syncHandlers,
  tagHandlers,
  userExamHandlers,
]

/**
 * 全チャンネルの実装。preload はこの型から署名を導く。
 *
 * スプレッドで畳むので、同じチャンネル名が2つあると後勝ちで**黙って消える**。
 * 登録時に件数を突き合わせて気付けるようにしてある（`setupAllIPCHandlers`）。
 */
export const handlers = {
  ...answerSheetBuilderHandlers,
  ...archiveHandlers,
  ...auditLogHandlers,
  ...authHandlers,
  ...courseworkHandlers,
  ...cropRegionHandlers,
  ...drawingHandlers,
  ...examClassroomHandlers,
  ...examHandlers,
  ...exportHandlers,
  ...gradeHandlers,
  ...miscHandlers,
  ...navigationHandlers,
  ...omrConfigHandlers,
  ...omrHandlers,
  ...pdfToolsHandlers,
  ...scoringHandlers,
  ...settingsHandlers,
  ...studentArchiveHandlers,
  ...studentHandlers,
  ...subtotalGroupHandlers,
  ...syncHandlers,
  ...tagHandlers,
  ...userExamHandlers,
}

/** チャンネル名 → 実装。preload の `invoke` が引数と戻り値をここから引く */
export type Handlers = typeof handlers

/** 全IPCハンドラーを一括登録する */
export function setupAllIPCHandlers(): void {
  const declaredCount = handlerGroups.reduce(
    (total, group) => total + Object.keys(group).length,
    0
  )
  const channels = Object.keys(handlers)
  if (channels.length !== declaredCount) {
    throw new Error(
      `IPC チャンネル名が重複しています（宣言 ${declaredCount} / 実際 ${channels.length}）`
    )
  }

  for (const channel of channels) {
    registerChannel(channel, handlers[channel as keyof Handlers])
  }
}
