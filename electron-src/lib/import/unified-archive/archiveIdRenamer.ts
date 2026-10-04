/**
 * 取り込み先の行の id を付け替える（統合アーカイブの取り込みで、アーカイブ側の id を採るとき）
 *
 * docs/unified-archive-design.md §7.3・§9。一意制約の衝突で「アーカイブの id」を選んだときと、
 * 照合で「同じもの・アーカイブの id」を選んだとき（旧 `idChangeExecutor.ts` の ID 統合の後継）に使う。
 *
 * - 行は `UPDATE … SET id` で付け替え、その行を参照する子の外部キーも `UPDATE` で付け替える。
 *   **削除して作り直さない**（旧 ID 統合は delete + 再作成で、移し替え漏れの子をカスケードで
 *   失った）。子は登録表（`archiveTableRegistry.ts`）の references から全て引くので、表ごとの
 *   移し替えの一覧を持たない
 * - ON UPDATE CASCADE には頼らない（onUpdate: NoAction の外部キーがある）。CASCADE の外部キーは
 *   SQLite が先に子を動かすので、続く `UPDATE` は0件になるだけ
 * - 付け替えの途中は親子が一時的にずれる。呼び出し側がトランザクションで
 *   `PRAGMA defer_foreign_keys = ON` にしておくこと
 * - id を JSON に埋め込んだ列（`archiveEmbeddedIds.ts`）も、取り込み先の行で書き換える
 * - updatedAt は変えない（付け替えは値の変更ではない。同期のトリガーは id の移動を拾う）
 *
 * ファイルのパスは書き換えない。パスに id が区切りとして入る表（ExamPage の Exam、
 * AsbImageElement の AsbDefinition）は一意制約を持たず、照合の対象でもないので、付け替えの
 * 対象にならない（unifiedArchiveImport.test.ts の規約テストが縛る）。
 */

import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import {
  ARCHIVE_EMBEDDED_ID_COLUMNS,
  remapEmbeddedIds,
} from "./archiveEmbeddedIds"
import type { ArchiveTargetConnection } from "./archiveRowImporter"

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** 表 `table` を指す外部キーの列（表, 列） */
const referencingColumnsOf = (
  table: string
): { table: string; column: string }[] =>
  Object.entries(ARCHIVE_TABLES).flatMap(([childTable, spec]) =>
    spec.references
      .filter((reference) => reference.table === table)
      .map((reference) => ({ table: childTable, column: reference.column }))
  )

/**
 * 取り込み先の `table` の行の id を `fromId` から `toId` へ付け替える。
 * `toId` が取り込み先に無いことは呼び出し側が確かめてあること
 */
export async function renameTargetRow(
  target: ArchiveTargetConnection,
  table: string,
  fromId: string,
  toId: string,
  warnings: string[]
): Promise<void> {
  await target.execute(`UPDATE ${quote(table)} SET id = ? WHERE id = ?`, [
    toId,
    fromId,
  ])
  for (const referencing of referencingColumnsOf(table)) {
    await target.execute(
      `UPDATE ${quote(referencing.table)} SET ${quote(referencing.column)} = ? WHERE ${quote(referencing.column)} = ?`,
      [toId, fromId]
    )
  }
  const newIdByOldId = new Map([[fromId, toId]])
  for (const embedded of ARCHIVE_EMBEDDED_ID_COLUMNS) {
    // 候補を文字列の包含で絞り、書き換えは JSON の値の完全一致で行う
    const embeddingRows = await target.query<unknown>(
      `SELECT id, ${quote(embedded.column)} AS jsonText FROM ${quote(embedded.table)} WHERE instr(${quote(embedded.column)}, ?) > 0`,
      [fromId]
    )
    for (const embeddingRow of embeddingRows) {
      if (
        !isRecord(embeddingRow) ||
        typeof embeddingRow.id !== "string" ||
        typeof embeddingRow.jsonText !== "string"
      ) {
        continue
      }
      const remapped = remapEmbeddedIds(embeddingRow.jsonText, newIdByOldId)
      if (remapped.kind === "unparsable") {
        warnings.push(
          `取り込み先の ${embedded.table}（${embeddingRow.id}）の ${embedded.column} を JSON として読めないため、${table} の id の付け替えを反映していません`
        )
        continue
      }
      if (remapped.text === embeddingRow.jsonText) continue
      await target.execute(
        `UPDATE ${quote(embedded.table)} SET ${quote(embedded.column)} = ? WHERE id = ?`,
        [remapped.text, embeddingRow.id]
      )
    }
  }
}
