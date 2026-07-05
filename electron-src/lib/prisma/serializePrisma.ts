/**
 * Prisma のクエリ結果を IPC 送信可能なプレーン値へ変換する共有シリアライザ。
 *
 * 従来は各ファイルが `JSON.parse(JSON.stringify(data))` を複製していたが、これは
 * decimal.js の `toJSON` が**文字列**を返すため、`Decimal` 列が実行時に文字列化し
 * （型は `number` を主張するのに実体は string）という乖離を生んでいた。
 *
 * このシリアライザは `Decimal` を明示的に `number` へ倒すことでその乖離を解消する。
 * `Date` は従来どおり ISO 文字列へ落とす（既存の JSON 直列化挙動を踏襲し、日付表示の
 * 回帰を避けるため）。それ以外は再帰的にクローンする。
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
  if (value instanceof Date) return value.toISOString()
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
