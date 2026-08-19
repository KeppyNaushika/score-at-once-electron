/**
 * 解答用紙の中身を1回書くための共通処理（担当の確認と、更新日時の繰り上げ）。
 *
 * 実体ごとの書き込み（`asbHeaderField.ts` など）はどれもこれを通す。各ハンドラに
 * 同じ確認を書くと必ずどれかで抜ける（実際、タグ付けで抜けていた）。
 */

import type { AsbDefinition, Prisma } from "@prisma/client"

import { getCurrentActorUserId } from "./auditActor"
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
export async function assertAsbDefinitionEditable(
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
 * @param write 実際に DB を書いたなら `true` を返す。`false` なら更新日時も動かさない
 */
export async function writeAsbDefinitionContent(
  definitionId: string,
  write: (tx: Prisma.TransactionClient) => Promise<boolean>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertAsbDefinitionEditable(tx, definitionId)
    const changed = await write(tx)
    if (!changed) return
    await tx.asbDefinition.update({
      where: { id: definitionId },
      data: { updatedAt: new Date() },
    })
  })
}
