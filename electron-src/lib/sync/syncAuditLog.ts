/**
 * 同期で隠れた行・表示に戻った行の監査ログ。
 */

import { syncTableLabel } from "@/lib/shared/syncTableLabels"

import type { AuditActionKey } from "../prisma/auditActions"
import { recordAuditLog } from "../prisma/auditLog"
import type { SyncRecordFold, SyncRecordFoldReport } from "./types"

/**
 * 隠れた行と表示に戻った行を監査ログへ残す（あとから見返す口はここ1つ。専用の
 * 履歴画面は作らない）。
 *
 * v0.19.0 までの `sync.merge`（行を消して1つにまとめた）とは**別の action** にする。
 * 今は何も消えないので、同じ名前で書くと、過去の「消した」記録と今の「隠した」記録が
 * 監査ログの上で見分けられなくなる。
 *
 * `coalesceKey` は**同じ端末が同じ出来事を二度書くのを止めるだけ**で、端末をまたいだ
 * 重複は畳めない。隠れる・戻るは各端末の作り直しでそれぞれ起きるが、相手の記録が届くのは
 * 相手が書いた次の同期以降で、書く時点のローカルDBにはまだ無い（`recordAuditLog` の
 * 突き合わせは書く瞬間のローカル行に対してしか働かない）。端末数ぶん行が並ぶのはそのため。
 */
export async function recordFoldAuditLogs(
  report: SyncRecordFoldReport
): Promise<void> {
  for (const fold of report.folds) {
    await recordFoldAuditLog("sync.duplicate.hide", fold)
  }
  for (const fold of report.restores) {
    await recordFoldAuditLog("sync.duplicate.restore", fold)
  }
}

/** 隠れた（または表示に戻った）行1つを監査ログへ書く。対象はその行（`losingId`） */
async function recordFoldAuditLog(
  action: AuditActionKey,
  fold: SyncRecordFold
): Promise<void> {
  await recordAuditLog({
    action,
    // システム操作は null（利用者が起こした操作ではない）
    userId: null,
    entityType: fold.tableName,
    entityId: fold.losingId,
    target: syncTableLabel(fold.tableName),
    extra: {
      losingId: fold.losingId,
      winningId: fold.winningId,
    },
    coalesceKey: `${action}:${fold.tableName}:${fold.losingId}`,
  })
}
