/**
 * 旧形式の取り込みで、アーカイブの1行を「id が一致すれば同じ行」の決まりで書く。
 *
 * 1. アーカイブの id で取り込み先を引く。在れば同じ行
 * 2. 無ければ一意キー（(成績算出, 生徒) など。表に一意キーがあるときだけ）で引く。
 *    同じキーの行は DB が2つ持てないので、それがこの行
 * 3. どちらも無ければアーカイブの id で作る
 *
 * 同じ行だと決まったら、値を置き換えるかは取り込みの規則（importValuePolicy）で決める。
 * 時刻を持たない行（旧形式で updatedAt を書き出していなかった表）は、統合では新しいと
 * みなさない（取り込み時刻を当てると、いつも取り込み先を上書きしてしまう）。
 * id で当たった行の親を指す列（一意キーの列）は、別の行とキーが重なるときだけ書かない。
 *
 * 旧形式の変換で合成した id（`legacy-student:S001` など。uuid でない）は実体の id ではないので、
 * id では引かず、作るときも使わない（id は原則 uuid）。
 */

import type { ImportValuePolicy } from "../merge/importValuePolicy"
import { replacementUpdatedAt } from "../merge/importValuePolicy"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 実体の id として使える（uuid の形をしている）か */
export const isUuid = (value: string): boolean => UUID_PATTERN.test(value)

interface IdFirstRowOptions<Row extends { id: string; updatedAt: Date }> {
  archiveId: string
  /** アーカイブの行の updatedAt（ISO 文字列）。旧形式で持たない表は null */
  archiveUpdatedAt: string | null | undefined
  policy: ImportValuePolicy
  findById: (id: string) => Promise<Row | null>
  /** 一意キーで引く（表に一意キーが無ければ渡さない） */
  findByKey?: () => Promise<Row | null>
  /** 作る。`id` が undefined なら取り込み先で振る（アーカイブの id が uuid でないとき） */
  create: (id: string | undefined) => Promise<{ id: string }>
  /**
   * 規則が置き換えると決めたときに書く。`writeKey` が false なら、一意キーの列（親を指す列）は
   * 書かない（書くと別の行とキーが重なる）
   */
  update: (
    existing: Row,
    updatedAt: Date,
    writeKey: boolean
  ) => Promise<unknown>
}

interface IdFirstRowResult {
  /** 取り込み先の行の id */
  targetId: string
  kind: "created" | "replaced" | "kept"
}

/**
 * 同じ行だと決まった既存の行を置き換えるなら、書き込む updatedAt を返す（置き換えないなら null）。
 * 時刻を持たないアーカイブの行は、上書きのときだけ置き換える
 */
export function archiveRowReplacedAt(
  policy: ImportValuePolicy,
  archiveUpdatedAt: string | null | undefined,
  existingUpdatedAt: Date
): Date | null {
  if (!archiveUpdatedAt && policy.action !== "overwrite") return null
  return replacementUpdatedAt(policy, archiveUpdatedAt, existingUpdatedAt)
}

export async function writeIdFirstRow<
  Row extends { id: string; updatedAt: Date },
>(options: IdFirstRowOptions<Row>): Promise<IdFirstRowResult> {
  const archiveIdUsable = isUuid(options.archiveId)
  const byId = archiveIdUsable
    ? await options.findById(options.archiveId)
    : null
  const byKey = options.findByKey ? await options.findByKey() : null
  const existing = byId ?? byKey

  if (!existing) {
    const created = await options.create(
      archiveIdUsable ? options.archiveId : undefined
    )
    return { targetId: created.id, kind: "created" }
  }

  const updatedAt = archiveRowReplacedAt(
    options.policy,
    options.archiveUpdatedAt,
    existing.updatedAt
  )
  if (!updatedAt) return { targetId: existing.id, kind: "kept" }
  await options.update(
    existing,
    updatedAt,
    byKey === null || byKey.id === existing.id
  )
  return { targetId: existing.id, kind: "replaced" }
}
