/**
 * 解答用紙の中身を1回書くための共通処理（担当の確認と、更新日時の繰り上げ、操作履歴）。
 *
 * 実体ごとの書き込み（`asbHeaderField.ts` など）はどれもこれを通す。各ハンドラに
 * 同じ確認を書くと必ずどれかで抜ける（実際、タグ付けで抜けていた）。操作履歴も
 * 同じ理由でここだけが書く（2026-08-19 に1件ずつの書き込みへ割ったとき、全経路で抜けた）。
 */

import type { AsbDefinition, Prisma } from "@prisma/client"

import { getCurrentActorUserId } from "./auditActor"
import { recordAuditLog } from "./auditLog"
import { resolveAnswerSheetScope } from "./auditScope"
import prisma from "./client"

/**
 * その解答用紙を編集してよいか確かめる。編集できるのは担当者だけ。
 *
 * **操作者は main が決める**（`getCurrentActorUserId`）。renderer が渡した `userId` を
 * 信じると、他端末で担当が移った後も手元の古い `user.id` で判定が通ってしまう。現在の
 * DB を見て初めて正しく判定できるので、判定は main にしか置けない。
 *
 * **これはセキュリティではない。** DB ファイルは全員の手元にあり、SQLite を直接開けば
 * 誰でも書き換えられる（docs/scoring-scope-and-permissions-design.md §2-4）。ここで
 * 防ぐのは**アプリの導線を通した誤操作**だけなので、文言も「担当を譲ってもらって
 * ください」までとする。
 */
export function assertAsbDefinitionEditableBy(definition: AsbDefinition): void {
  const actorUserId = getCurrentActorUserId()
  if (actorUserId === null) {
    throw new Error(
      "ログインしている利用者が分からないため、解答用紙を編集できません"
    )
  }
  if (definition.userId !== actorUserId) {
    throw new Error(
      "この解答用紙の担当ではないため編集できません。担当を譲ってもらってください。"
    )
  }
}

/** 解答用紙を引いて、編集してよいか確かめる */
async function assertAsbDefinitionEditable(
  tx: Prisma.TransactionClient,
  definitionId: string
): Promise<void> {
  const definition = await tx.asbDefinition.findUnique({
    where: { id: definitionId },
  })
  if (!definition) {
    throw new Error("解答用紙が見つかりません")
  }
  assertAsbDefinitionEditableBy(definition)
}

/**
 * 解答用紙の中身を1回書く。
 *
 * 担当の確認・書き込み・解答用紙そのものの更新日時を、1つのトランザクションで行う。
 * 子だけが変わったときも「解答用紙が更新された」ことは一覧へ出す必要がある（出さないと
 * 並べ替えも期間の絞り込みも古い時刻で答える）。空の `data` では `@updatedAt` は動かない
 * ので、時刻を明示的に渡す。
 *
 * 操作履歴は書かない。解答用紙の編集として残すものは {@link editAsbDefinitionContent} を通す
 * （タグの付け外しのように、別のアクションで記録する書き込みもこれを使うため）。
 *
 * @param write 実際に DB を書いたなら `true` を返す。`false` なら更新日時も動かさない
 * @returns 実際に DB を書いたか
 */
export async function writeAsbDefinitionContent(
  definitionId: string,
  write: (tx: Prisma.TransactionClient) => Promise<boolean>
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await assertAsbDefinitionEditable(tx, definitionId)
    const changed = await write(tx)
    if (!changed) return false
    await tx.asbDefinition.update({
      where: { id: definitionId },
      data: { updatedAt: new Date() },
    })
    return true
  })
}

/**
 * 解答用紙の編集の集約キー。
 *
 * 解答用紙作成は打鍵・ドラッグで続けて書くので、1件ずつ記録すると操作履歴が埋まる。
 * 解答用紙ごとに1つのキーにして、同じ操作者の5分以内の編集を1行へまとめる（操作者の
 * 照合は `recordAuditLog` が行う）。全面置き換え（undo / redo）の更新も同じキーで書く。
 */
export function asbDefinitionEditCoalesceKey(definitionId: string): string {
  return `answer_sheet.edit:${definitionId}`
}

/**
 * 解答用紙の中身を1回書き、解答用紙の編集（`answer_sheet.update`）として操作履歴に残す。
 *
 * 記録は書き込みの後、トランザクションの外で行う（ベストエフォート。`recordAuditLog` は
 * 例外を投げない）。何も変わらなかった書き込みは記録しない。作業領域のラベルは書いた後の
 * 解答用紙の名前（名前を変えた編集なら新しい名前）。
 */
export async function editAsbDefinitionContent(
  definitionId: string,
  write: (tx: Prisma.TransactionClient) => Promise<boolean>
): Promise<void> {
  const changed = await writeAsbDefinitionContent(definitionId, write)
  if (!changed) return
  const { scopeId, scopeLabel } = await resolveAnswerSheetScope(definitionId)
  await recordAuditLog({
    action: "answer_sheet.update",
    entityType: "AsbDefinition",
    entityId: definitionId,
    scopeId,
    scopeLabel,
    target: scopeLabel,
    coalesceKey: asbDefinitionEditCoalesceKey(definitionId),
  })
}
