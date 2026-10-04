/**
 * 登録表の参照（references）に載らない、列の中に埋め込まれた id の書き換え
 *
 * 「別で追加」で根の子孫の id を振り直すと（docs/unified-archive-design.md §7.2）、外部キーの列は
 * 登録表の references から書き換えられるが、JSON の中に畳まれた id は届かない。そうした列を
 * ここに**名指しで**並べ、JSON をほどいて、文字列の値が振り直した旧 id と完全に一致するものだけを
 * 新しい id にする（キーは触らない）。
 *
 * 名指しにするのは、全ての文字列の列から uuid の形を拾って置き換える方式（旧取り込みの
 * `separateExamRewriter.ts`）だと、id のつもりで書いていない値まで化けうるため。どの列が id を
 * 埋め込んでいるかは schema とその列を書くコードを読んで確かめ、ここに載せる。
 * **id を埋め込む列を schema に足したら、ここにも足すこと。**
 *
 * 今の schema で references の外に id を持つ列（2026-10-04 に schema を洗った結果）:
 * - ReturnSnapshot.scoresJson — 返却版の中身。cropRegionId（`r`）を持つ。ここで書き換える
 * - AuditLog.userId / scopeId / entityId / metadata / coalesceKey、AuditLogTarget.targetId —
 *   監査ログ（とその対象）は振り直さず追記だけなので、元の id を指したまま残す（元の行は
 *   消えないので記録として正しい）
 */

/** id を JSON に埋め込んでいる列（表 → 列） */
export const ARCHIVE_EMBEDDED_ID_COLUMNS: readonly {
  readonly table: string
  readonly column: string
}[] = [{ table: "ReturnSnapshot", column: "scoresJson" }]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** 表の列のうち、id を JSON に埋め込んでいるもの */
export const embeddedIdColumnsOf = (table: string): ReadonlySet<string> =>
  new Set(
    ARCHIVE_EMBEDDED_ID_COLUMNS.filter(
      (embeddedColumn) => embeddedColumn.table === table
    ).map((embeddedColumn) => embeddedColumn.column)
  )

/** JSON の値をたどり、旧 id と完全一致する文字列を新しい id にする。変えたかどうかも返す */
const replaceIdsInJson = (
  jsonValue: unknown,
  newIdByOldId: ReadonlyMap<string, string>
): { replaced: unknown; changed: boolean } => {
  if (typeof jsonValue === "string") {
    const newId = newIdByOldId.get(jsonValue)
    return newId === undefined
      ? { replaced: jsonValue, changed: false }
      : { replaced: newId, changed: true }
  }
  if (Array.isArray(jsonValue)) {
    const elements = jsonValue.map((element) =>
      replaceIdsInJson(element, newIdByOldId)
    )
    return {
      replaced: elements.map((element) => element.replaced),
      changed: elements.some((element) => element.changed),
    }
  }
  if (isRecord(jsonValue)) {
    const entries = Object.entries(jsonValue).map(
      ([key, entryValue]): [
        string,
        { replaced: unknown; changed: boolean },
      ] => [key, replaceIdsInJson(entryValue, newIdByOldId)]
    )
    return {
      replaced: Object.fromEntries(
        entries.map(([key, entry]) => [key, entry.replaced])
      ),
      changed: entries.some(([, entry]) => entry.changed),
    }
  }
  return { replaced: jsonValue, changed: false }
}

export type EmbeddedIdRemapResult =
  | { readonly kind: "ok"; readonly text: string }
  | { readonly kind: "unparsable" }

/**
 * JSON の文字列の中の旧 id を新しい id にした文字列を返す。何も変わらなければ元の文字列のまま
 * （書き方の揺れを持ち込まない）。JSON として読めなければ unparsable
 */
export function remapEmbeddedIds(
  jsonText: string,
  newIdByOldId: ReadonlyMap<string, string>
): EmbeddedIdRemapResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { kind: "unparsable" }
  }
  const { replaced, changed } = replaceIdsInJson(parsed, newIdByOldId)
  return { kind: "ok", text: changed ? JSON.stringify(replaced) : jsonText }
}
