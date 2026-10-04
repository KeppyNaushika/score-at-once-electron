/**
 * 統合アーカイブ（.sao）の表を書く順番
 *
 * 外部キーの親が先になるよう、登録表（`archiveTableRegistry.ts`）の references から位相順を
 * 求める。DB の `foreign_key_list` は使わない（登録表の冒頭の理由と同じ）。順番が決まらない
 * 表（同じ順位）は登録表に並べた順にする。
 *
 * 自己参照・循環があると親を先に書けないので、そのときは `needsDeferredForeignKeys` を立てる。
 * 書く側はトランザクションの中で `PRAGMA defer_foreign_keys = ON` にし、外部キーの検査を
 * コミットまで遅らせる（違反が残ればコミットで SQLite が拒む）。今の schema には無い。
 */

import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"

export interface ArchiveTableOrder {
  /** 親が先の順に並べた表名 */
  readonly tables: readonly string[]
  /** 自己参照か循環があり、外部キーの検査を遅らせなければ書けない */
  readonly needsDeferredForeignKeys: boolean
}

/** `tableNames`（登録表に載っている表）を、外部キーの親が先になる順に並べる */
export function orderArchiveTables(
  tableNames: readonly string[]
): ArchiveTableOrder {
  const registryOrder = Object.keys(ARCHIVE_TABLES)
  const present = new Set(tableNames)
  const pending = registryOrder.filter((table) => present.has(table))

  let needsDeferredForeignKeys = false
  /** 表 → まだ書いていない親の表 */
  const unwrittenParents = new Map<string, Set<string>>()
  for (const table of pending) {
    const parents = new Set<string>()
    for (const reference of ARCHIVE_TABLES[table].references) {
      if (reference.table === table) {
        needsDeferredForeignKeys = true
        continue
      }
      if (present.has(reference.table)) parents.add(reference.table)
    }
    unwrittenParents.set(table, parents)
  }

  const ordered: string[] = []
  let remaining = pending
  while (remaining.length > 0) {
    const ready = remaining.filter(
      (table) => (unwrittenParents.get(table)?.size ?? 0) === 0
    )
    // 親を待つ表しか残っていない ＝ 循環。残りは登録表の順で書き、検査を遅らせる
    const next = ready.length > 0 ? ready : remaining
    if (ready.length === 0) needsDeferredForeignKeys = true
    for (const table of next) {
      ordered.push(table)
      for (const parents of unwrittenParents.values()) parents.delete(table)
    }
    const written = new Set(next)
    remaining = remaining.filter((table) => !written.has(table))
  }
  return { tables: ordered, needsDeferredForeignKeys }
}
