/**
 * DB に String で保存される「値の集合が固定の列」を、型で保証された literal union として
 * 扱うための共通土台。SQLite(Prisma) は enum 非対応のため、こうした列（採点ステータス・
 * 受験状態・データソース種別など）の唯一の集約点は TypeScript の union になる。
 *
 * 各 union は「①定数配列 → 型 → ②型ガード(is) → ③境界コンバータ(to)」の3点セットで表すが、
 * ②③は選択肢と外れ値の既定値だけが違う定型なので、この factory で生成する
 * （union 手書き重複の禁止＝ドリフト防止）。
 *
 * ③の `to` は「Prisma 拡張型の上書き注入」（`Omit<Model, "col"> & { col: Union }`）の実行時の相棒で、
 * 境界（hydrate/serialize）で生 String を union へ絞り込み、型＝実体を一致させる。
 */
export function defineStringUnion<T extends string>(
  values: readonly T[],
  fallback: T
): {
  /** 任意の値がこの union のメンバーかを判定する型ガード */
  is: (value: unknown) => value is T
  /** DB/JSON 由来の文字列を安全に union へ絞り込む。外れ値は fallback。 */
  to: (value: string | null | undefined) => T
} {
  const isMember = (value: unknown): value is T =>
    typeof value === "string" && (values as readonly string[]).includes(value)
  return {
    is: isMember,
    to: (value) => (isMember(value) ? value : fallback),
  }
}
