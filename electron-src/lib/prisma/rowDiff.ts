/**
 * 変わっていない行は書かない、を1箇所に置く。
 *
 * 木をまるごと受け取って保存する経路（解答用紙など）は、素直に書くと毎回全行を
 * 上書きする。全行を上書きすると触っていない行まで `updatedAt` が「今」になり、
 * 同期の行ごとの LWW で**後から保存した端末の木が丸ごと勝つ**。2端末が別々の大問を
 * 編集しただけで相手の編集が消える。触った行だけを書けば、重ならない編集は両方残る。
 *
 * 変更履歴（`_changelog`）に流れる量も、保存1回につき全行から差分だけになる。
 */

/**
 * DB の行と、これから書こうとしている値が同じか。
 *
 * 比べるのは `data` に載っている列だけ（`id` / `createdAt` / `updatedAt` は載らない）。
 * `undefined` と `null` は同じものとして扱う — DB は null しか持たないため。
 */
export function isUnchanged(
  existing: Record<string, unknown>,
  data: Record<string, unknown>
): boolean {
  return Object.entries(data).every(
    ([column, value]) => (existing[column] ?? null) === (value ?? null)
  )
}

/**
 * 無ければ作り、変わっていれば更新し、同じなら何もしない。
 *
 * `create` / `update` を関数で受け取るのは、Prisma のモデルごとの型を呼び出し側に
 * 残すため（1つのヘルパーで全モデルを受けようとすると `any` になる）。
 */
export async function writeRow(
  existing: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
  create: () => Promise<unknown>,
  update: () => Promise<unknown>
): Promise<void> {
  if (!existing) {
    await create()
    return
  }
  if (isUnchanged(existing, data)) return
  await update()
}

/** id で引けるようにする */
export function byId<Row extends { id: string }>(
  rows: Row[]
): Map<string, Row> {
  return new Map(rows.map((row) => [row.id, row]))
}
