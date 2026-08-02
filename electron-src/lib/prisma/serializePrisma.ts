/**
 * Prisma のクエリ結果を IPC 送信可能なプレーン値へ変換する共有シリアライザ。
 *
 * 従来は各ファイルが `JSON.parse(JSON.stringify(data))` を複製していたが、これは
 * decimal.js の `toJSON` が**文字列**を返すため、`Decimal` 列が実行時に文字列化し
 * （型は `number` を主張するのに実体は string）という乖離を生んでいた。
 *
 * 変換するのは `Decimal` → `number` **だけ**。decimal.js のインスタンスはメソッドを
 * 持つクラスなので structured clone を渡れず、ここで倒す必要がある。
 *
 * `Date` は変換しない。structured clone は Date をそのまま渡せるため、変換は IPC の
 * 要件ではなく旧 `JSON.stringify` 挙動の名残でしかなく、「型は `Date` / 実体は string」
 * という乖離を全経路にばら撒いていた（型を正直にするより、乖離を作らない方が安い）。
 */

import { Prisma } from "@prisma/client"

/**
 * Prisma/decimal.js の Decimal を、コンストラクタ同一性に依存せず判定する。
 * `instanceof` は decimal.js が二重コピー（driver adapter 等）だと外れうるため、
 * `.toNumber()` を持つ Decimal-like を duck-typing で拾う（Prisma のクエリ結果で
 * `.toNumber()` を持つのは Decimal のみ）。旧 `JSON.stringify`+`toJSON` 相当の堅牢性。
 */
function isDecimalLike(value: object): value is { toNumber(): number } {
  return (
    value instanceof Prisma.Decimal ||
    ("toNumber" in value &&
      typeof (value as { toNumber: unknown }).toNumber === "function")
  )
}

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== "object") return value
  if (isDecimalLike(value)) return value.toNumber()
  // Date は structured clone を渡れる。列挙可能な自前プロパティを持たないので、
  // 下の Object.entries へ落とすと `{}` になってしまう。ここで複製して返す。
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(convert)
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    // JSON.stringify に倣い、undefined のプロパティは落とす。
    if (child === undefined) continue
    result[key] = convert(child)
  }
  return result
}

/** Prisma Decimal を number へ倒しつつ、IPC 送信可能なプレーン値へ変換する。 */
export function serializePrisma<T>(data: T): T {
  return convert(data) as T
}
