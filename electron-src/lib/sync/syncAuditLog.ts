/**
 * 同期で隠れた行・表示に戻った行の監査ログ。
 *
 * 隠れ方は2つある。別id・同一ユニークキーでかぶった片方が隠れる（`folds` / `restores`）
 * ものと、親が他のPCで削除されて子が表から外れる（`parentDeleted` / `parentReturned`）もの。
 */

import { syncTableLabel } from "@/lib/shared/syncTableLabels"

import type { AuditActionKey } from "../prisma/auditActions"
import { recordAuditLog } from "../prisma/auditLog"
import type {
  SyncParentDeleted,
  SyncParentDeletedReport,
  SyncRecordFold,
  SyncRecordFoldReport,
} from "./types"

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

/**
 * 親の削除で表から外れた行と、親が作り直されて戻った行を監査ログへ残す。
 *
 * トーストは閉じれば消えるので、「なぜこの行が見えなくなったのか」をあとから辿る
 * 手がかりはここにしか残らない。
 *
 * **削除された親1つにつき1行**にまとめる。親の削除と並行して採点を続けていれば、
 * 1回の同期で数百行が外れうる。1行ずつ書くと監査ログがそれで埋まる。
 *
 * `coalesceKey` は付けない。同じ親の子が次の同期に分かれて届くことがあり、集約すると
 * 回数が増えるだけで後から届いた行の一覧（`records`）が捨てられる。端末数ぶん行が
 * 並ぶのは `recordFoldAuditLogs` と同じ。
 */
export async function recordParentDeletedAuditLogs(
  report: SyncParentDeletedReport
): Promise<void> {
  for (const records of groupByCause(report.parentDeleted)) {
    await recordParentDeletedAuditLog("sync.parent_deleted.hide", records)
  }
  for (const records of groupByCause(report.parentReturned)) {
    await recordParentDeletedAuditLog("sync.parent_deleted.restore", records)
  }
}

/** 削除された親（`causeTable` と `causeId` の組）ごとに束ねる。出てきた順を保つ */
function groupByCause(records: SyncParentDeleted[]): SyncParentDeleted[][] {
  const groups = new Map<string, SyncParentDeleted[]>()
  for (const record of records) {
    const causeKey = `${record.causeTable}:${record.causeId}`
    const group = groups.get(causeKey)
    if (group) group.push(record)
    else groups.set(causeKey, [record])
  }
  return [...groups.values()]
}

/**
 * 同じ親にぶら下がっていた行の束を1行で書く。対象は削除された親。
 *
 * 行の中身（`content`）は載せない。ライブラリの帳簿に残っているので id で足り、
 * 載せると監査ログ（同期で全端末へ渡る）が膨らむ。
 */
async function recordParentDeletedAuditLog(
  action: AuditActionKey,
  records: SyncParentDeleted[]
): Promise<void> {
  const { causeTable, causeId } = records[0]
  const countByTable = records.reduce<Record<string, number>>(
    (acc, record) => ({
      ...acc,
      [record.tableName]: (acc[record.tableName] ?? 0) + 1,
    }),
    {}
  )
  await recordAuditLog({
    action,
    // システム操作は null（利用者が起こした操作ではない）
    userId: null,
    entityType: causeTable,
    entityId: causeId,
    target: syncTableLabel(causeTable),
    extra: {
      causeTable,
      causeId,
      count: records.length,
      countByTable,
      records: records.map((record) => ({
        tableName: record.tableName,
        recordId: record.recordId,
      })),
    },
  })
}
