/**
 * 採点画面の側面パネルで畳んでいる節（UserSidePanelSection）の読み書き。
 *
 * かつては「畳んでいる節の id の配列」を1キーの JSON に入れていた。続けて2つ畳むと
 * 先の1つが開いたままになる（塊で読み書きするため）。
 *
 * **行が無い節は開いている。** 一度畳んで開き直した節は `collapsed = false` の行として
 * 残る — 行を消す形にすると、開け閉めのたびに作成と削除が同期の変更履歴へ流れる。
 */

import type { UserSidePanelSection } from "@prisma/client"

import prisma from "./client"

/** その利用者の節の開閉（行が無い節は開いている） */
export async function listUserSidePanelSections(
  userId: string
): Promise<UserSidePanelSection[]> {
  return prisma.userSidePanelSection.findMany({ where: { userId } })
}

/** 節1つぶんの開閉を書く */
export async function setUserSidePanelSection(
  userId: string,
  sectionId: string,
  collapsed: boolean
): Promise<void> {
  await prisma.userSidePanelSection.upsert({
    where: { userId_sectionId: { userId, sectionId } },
    update: { collapsed },
    create: { userId, sectionId, collapsed },
  })
}
