/**
 * 取り込み先の一意制約で、アーカイブの行とぶつかる既存の行を引く
 *
 * docs/unified-archive-design.md §7.3 の検知（解決は段階4）。対象は主キー以外の一意索引
 * （`@@unique` と1列の `@unique`。Prisma は `CREATE UNIQUE INDEX` で張るので origin は 'c'、
 * 表の定義に書いた UNIQUE なら 'u'）。条件つきの索引（partial）は、条件の評価を SQLite に
 * 任せたいので検知しない。ぶつかれば書き込みが UNIQUE 違反で失敗し、全体がロールバックする。
 *
 * 値の比べ方を JS 側で真似ない。アーカイブの値を `VALUES` に並べて取り込み先の表と結び、
 * SQLite に比べさせる（列の型の変換が SQLite の規則どおりになる）。
 */

/** 取り込み先への読み取り（`ArchiveTargetConnection.query` の形） */
export type ArchiveTargetQuery = (
  sql: string,
  params: readonly unknown[]
) => Promise<unknown[]>

export interface ArchiveUniqueIndex {
  readonly name: string
  readonly columns: readonly string[]
}

/** 1つの索引で引く、書こうとしている行の値 */
export interface ArchiveUniqueProbe {
  /** 呼び出し側が行を見分ける番号 */
  readonly probeIndex: number
  /** 索引の列の順に並べた値（NULL を含まないこと。NULL は一意制約にかからない） */
  readonly values: readonly unknown[]
}

export interface ArchiveUniqueMatch {
  readonly probeIndex: number
  readonly existingId: string
}

/** 1回の問い合わせに載せる変数の上限 */
export const SQL_VARIABLE_LIMIT = 500

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** SQLite の整数（ドライバによって number か bigint で来る）を number にする */
const toInteger = (value: unknown): number | null => {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  return null
}

export const chunkItems = <Item>(
  items: readonly Item[],
  size: number
): Item[][] => {
  const chunks: Item[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** 表の、主キー以外・条件なしの一意索引と、その列 */
export async function listArchiveUniqueIndexes(
  query: ArchiveTargetQuery,
  table: string
): Promise<ArchiveUniqueIndex[]> {
  const indexRows = await query(`PRAGMA index_list(${quote(table)})`, [])
  const uniqueIndexes: ArchiveUniqueIndex[] = []
  for (const indexRow of indexRows) {
    if (!isRecord(indexRow)) continue
    const { name, origin } = indexRow
    if (typeof name !== "string") continue
    if (toInteger(indexRow.unique) !== 1) continue
    if (toInteger(indexRow.partial) !== 0) continue
    if (origin !== "u" && origin !== "c") continue

    const columnRows = await query(`PRAGMA index_info(${quote(name)})`, [])
    const columns: { seqno: number; name: string }[] = []
    let hasExpression = false
    for (const columnRow of columnRows) {
      if (!isRecord(columnRow)) continue
      const seqno = toInteger(columnRow.seqno)
      if (seqno === null || typeof columnRow.name !== "string") {
        // 式の索引（列名が NULL）は値を組めないので、partial と同じく SQLite に任せる
        hasExpression = true
        continue
      }
      columns.push({ seqno, name: columnRow.name })
    }
    if (hasExpression || columns.length === 0) continue
    uniqueIndexes.push({
      name,
      columns: columns
        .sort((left, right) => left.seqno - right.seqno)
        .map((column) => column.name),
    })
  }
  return uniqueIndexes
}

/** 索引の列の値が一致する既存の行を引く（同じ id の行も返す。除くのは呼び出し側） */
export async function findArchiveUniqueMatches(
  query: ArchiveTargetQuery,
  table: string,
  uniqueIndex: ArchiveUniqueIndex,
  probes: readonly ArchiveUniqueProbe[]
): Promise<ArchiveUniqueMatch[]> {
  const columnCount = uniqueIndex.columns.length
  const probeColumns = uniqueIndex.columns.map((_, position) => `c${position}`)
  const rowsPerQuery = Math.max(
    1,
    Math.floor(SQL_VARIABLE_LIMIT / (columnCount + 1))
  )
  const rowPlaceholder = `(${Array.from({ length: columnCount + 1 }, () => "?").join(", ")})`
  const joinCondition = uniqueIndex.columns
    .map(
      (column, position) =>
        `existing.${quote(column)} = probe.${probeColumns[position]}`
    )
    .join(" AND ")

  const matches: ArchiveUniqueMatch[] = []
  for (const probeChunk of chunkItems(probes, rowsPerQuery)) {
    const sql = `WITH probe(probeIndex, ${probeColumns.join(", ")}) AS (VALUES ${probeChunk
      .map(() => rowPlaceholder)
      .join(", ")})
      SELECT probe.probeIndex AS probeIndex, existing.id AS existingId
      FROM probe JOIN ${quote(table)} AS existing ON ${joinCondition}`
    const params = probeChunk.flatMap((probe) => [
      probe.probeIndex,
      ...probe.values,
    ])
    for (const matchRow of await query(sql, params)) {
      if (!isRecord(matchRow)) continue
      const probeIndex = toInteger(matchRow.probeIndex)
      const { existingId } = matchRow
      if (probeIndex === null || typeof existingId !== "string") continue
      matches.push({ probeIndex, existingId })
    }
  }
  return matches
}
