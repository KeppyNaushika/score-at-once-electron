/**
 * 取り込みの値の扱いを一本化する規則（convention-as-code）
 *
 * **人が取り込みの最初に選んだ操作が、取り込む全てのレコードの全ての値に、例外なく
 * 同じように効く。** 項目ごとの選択も、実体ごとの特別扱いも作らない。
 *
 * | 選択           | 既存と一致した行                                   | 新しく作る行                    |
 * | -------------- | -------------------------------------------------- | ------------------------------- |
 * | overwrite      | 無条件に置き換える。updatedAt = 取り込み時刻        | createdAt/updatedAt = 取り込み時刻 |
 * | merge          | LWW（アーカイブが新しいときだけ）。updatedAt は元値 | createdAt/updatedAt = アーカイブの値 |
 * | separate       | **触らない**                                        | createdAt/updatedAt = アーカイブの値 |
 *
 * なぜ時刻の扱いが操作で変わるか:
 * - overwrite は「いま自分がこう決めた」という記録。アーカイブの時刻を保つと、次の同期で
 *   相手の新しい行に負けて**上書きが取り消される**
 * - merge は2つの履歴を合わせる操作で、LWW が比べるのは「本当に編集された時刻」。
 *   取り込み時刻へ倒すと取り込んだ行が常に最新に見え、**LWW が死ぬ**
 * - separate は誰とも競合しない新しい行。時刻を今へ付け替える理由が無い
 *
 * **separate が既存の行に触らない**のは、「別で追加する」が「今あるものに手を触れずに、
 * もう一つ入れる」操作だから。試験の配下は id を振り直すのでそもそも一致が起きないが、
 * 生徒・学級・小計グループ・タグは試験ではないので振り直さず、一致が起きる。
 * そこで既存を書き換えてしまうと「手を触れずに」が嘘になる（足りないものは足す）。
 *
 * createdAt は「既にある行」なら動かさない（生まれた時刻は取り込みで変わらない）。
 *
 * 取り込み時刻は**1回の取り込みで1つ**に固定する（行ごとに now() を取ると、同じ操作で
 * 入った行の時刻がばらけ、後から見て一括の取り込みだと分からなくなる）。
 *
 * LWW の判定そのものは decisionMergePolicy の isNewerByLww に一本化してある。
 */

import { isNewerByLww } from "./decisionMergePolicy"

/** 既存と一致した行をどうするか、という人の選択 */
export type ImportValueAction = "overwrite" | "merge" | "separate"

/** アーカイブの行が持つ時刻（旧アーカイブは欠けることがある） */
interface ArchiveTimestamps {
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ImportValuePolicy {
  readonly action: ImportValueAction
  /** この取り込みの時刻（1回の取り込みで1つ） */
  readonly importedAt: Date
  /** 既存の行をアーカイブの値で置き換えるか */
  shouldReplaceExisting(
    incomingUpdatedAt: Date,
    existingUpdatedAt: Date
  ): boolean
  /** 置き換えるときに入れる updatedAt */
  replacedUpdatedAt(incomingUpdatedAt: Date): Date
  /** 新しく作る行に入れる createdAt / updatedAt */
  createdTimestamps(archiveRow: ArchiveTimestamps): {
    createdAt: Date
    updatedAt: Date
  }
}

/** 文字列の時刻を Date にする。欠けている/読めないものは既定へ倒す */
function toDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function createImportValuePolicy(
  action: ImportValueAction,
  importedAt: Date = new Date()
): ImportValuePolicy {
  return {
    action,
    importedAt,
    shouldReplaceExisting(incomingUpdatedAt, existingUpdatedAt) {
      if (action === "overwrite") return true
      if (action === "separate") return false
      return isNewerByLww(incomingUpdatedAt, existingUpdatedAt)
    },
    replacedUpdatedAt(incomingUpdatedAt) {
      return action === "overwrite" ? importedAt : incomingUpdatedAt
    },
    createdTimestamps(archiveRow) {
      if (action === "overwrite") {
        return { createdAt: importedAt, updatedAt: importedAt }
      }
      return {
        createdAt: toDate(archiveRow.createdAt, importedAt),
        updatedAt: toDate(archiveRow.updatedAt, importedAt),
      }
    },
  }
}

/**
 * 一致した行を置き換えるなら、書き込む `updatedAt` を返す。置き換えないなら null。
 *
 * 呼ぶ側は `const replacedAt = replacementUpdatedAt(...); if (!replacedAt) continue` の形で
 * 「置き換えるか」と「何時にするか」を一度に受け取る（2つに分けると、片方だけ規則から
 * 外れた書き方が混ざる）。
 */
export function replacementUpdatedAt(
  policy: ImportValuePolicy,
  incomingUpdatedAt: string | null | undefined,
  existingUpdatedAt: Date
): Date | null {
  const incoming = toDate(incomingUpdatedAt, policy.importedAt)
  if (!policy.shouldReplaceExisting(incoming, existingUpdatedAt)) return null
  return policy.replacedUpdatedAt(incoming)
}
