/**
 * 連続クリックでの採点（UserClickScoringAction）の読み書き。
 *
 * 2〜4回のクリックそれぞれに動作を割り当てる。1キーの JSON に3つ入れていた頃は、
 * 続けて2つ変えると先の1つが消えた（塊で読み書きするため）。
 */

import type { UserClickScoringAction } from "@prisma/client"

import prisma from "./client"

/** その利用者の割り当て（行が無い回数は画面が既定で埋める） */
export async function listUserClickScoringActions(
  userId: string
): Promise<UserClickScoringAction[]> {
  return prisma.userClickScoringAction.findMany({ where: { userId } })
}

/** クリック回数1つぶんの動作を書く */
export async function setUserClickScoringAction(
  userId: string,
  clickCount: number,
  action: string
): Promise<void> {
  await prisma.userClickScoringAction.upsert({
    where: { userId_clickCount: { userId, clickCount } },
    update: { action },
    create: { userId, clickCount, action },
  })
}
