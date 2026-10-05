/**
 * @fileoverview タグの付け外しを操作履歴へ残す共通処理
 * @description 試験・解答用紙・成績算出・資料・小計グループの5つが、同じ形でタグを
 *   付け外しする。記録の形（changes に付け替え前後のタグ名、変化が無ければ記録しない）を
 *   ここにそろえる。タグ名は表示用のスナップショットで、タグが後で消えても残る
 *   （docs/audit-log-redesign.md「削除耐性の原則」）。
 */

import type { Tag } from "@prisma/client"

import type { AuditActionKey } from "@/lib/shared/auditActions"

import { type AuditChange, recordAuditLog } from "./auditLog"

/** タグ名を、タグ一覧の並び順（同順なら名前順）で「、」区切りにする */
const joinTagNames = (tags: Tag[]): string =>
  [...tags]
    .sort(
      (leftTag, rightTag) =>
        leftTag.order - rightTag.order ||
        leftTag.name.localeCompare(rightTag.name, "ja")
    )
    .map((tag) => tag.name)
    .join("、")

/**
 * 付け替え前後のタグから変更内容を作る。付いているタグの集まりが同じなら空。
 *
 * 比べるのはタグの id（名前は表示用）。並び順の違いは変化に数えない。
 */
export function tagLinkChanges(
  beforeTags: Tag[],
  afterTags: Tag[]
): AuditChange[] {
  const beforeTagIds = new Set(beforeTags.map((tag) => tag.id))
  const afterTagIds = new Set(afterTags.map((tag) => tag.id))
  const unchanged =
    beforeTagIds.size === afterTagIds.size &&
    [...afterTagIds].every((tagId) => beforeTagIds.has(tagId))
  if (unchanged) return []
  return [
    {
      field: "tags",
      label: "タグ",
      before: joinTagNames(beforeTags),
      after: joinTagNames(afterTags),
    },
  ]
}

interface RecordTagLinkAuditInput {
  action: AuditActionKey
  /** 紐付けのテーブル名（`ExamTag` など） */
  entityType: string
  /** タグを付けた先の id */
  entityId: string
  /** 作業領域（小計グループのように持たないものは省く） */
  scopeId?: string | null
  scopeLabel?: string | null
  /** タグを付けた先の名前（サマリの `{target}`） */
  target: string | null
  beforeTags: Tag[]
  afterTags: Tag[]
  /** 続けて触る画面から呼ばれるものだけ渡す */
  coalesceKey?: string
}

/**
 * タグの付け外しを記録する。付いているタグが変わっていなければ記録しない。
 *
 * 書き込みの後に呼ぶ（トランザクションの外。記録の失敗は主操作を壊さない）。
 */
export async function recordTagLinkAudit(
  input: RecordTagLinkAuditInput
): Promise<void> {
  const changes = tagLinkChanges(input.beforeTags, input.afterTags)
  if (changes.length === 0) return
  await recordAuditLog({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    scopeId: input.scopeId,
    scopeLabel: input.scopeLabel,
    target: input.target,
    changes,
    coalesceKey: input.coalesceKey,
  })
}
