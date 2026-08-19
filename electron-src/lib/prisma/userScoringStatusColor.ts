/**
 * 採点状態ごとの表示色（UserScoringStatusColor）の読み書き。
 *
 * かつては `UserPreference` の1キーに7状態ぶんの JSON を丸ごと入れていた。塊で読み書き
 * すると、**続けて2色変えたときに先の1色が消える**（取り直しが着地する前に、古い写しへ
 * 2度目を重ねて書くため）。行へ割れば別々の行を書くので、その競合そのものが無くなる。
 */

import type { Prisma, UserScoringStatusColor } from "@prisma/client"

import prisma from "./client"
import { updateRowIfChanged } from "./rowDiff"

/** 1状態ぶんの色（DB の列そのまま） */
export interface UserScoringStatusColorValues {
  backgroundColor: string
  textColor: string
  iconColor: string
}

/** 状態と色の組（プリセットを当てるときに、まとめて受け取る） */
export interface UserScoringStatusColorEntry extends UserScoringStatusColorValues {
  status: string
}

/**
 * どの配色プリセットを選んでいるか。
 *
 * 色そのものとは別の設定で、置き場所は `UserPreference` のまま（1つの値で、割る先が
 * 無い）。**色を1つでも触ればプリセットからは外れる**ので、色の書き込みと同じ
 * トランザクションで消す — 別々に書くと、外れたはずのプリセットが選ばれたまま見える。
 */
const PRESET_ID_KEY = "scoringColorPresetId"

async function writePresetId(
  tx: Prisma.TransactionClient,
  userId: string,
  presetId: string | null
): Promise<void> {
  if (presetId === null) {
    await tx.userPreference.deleteMany({
      where: { userId, key: PRESET_ID_KEY },
    })
    return
  }
  // 保存文字列の形は renderer の `serializePreference`（string? は JSON でくるむ）に合わせる
  const value = JSON.stringify(presetId)
  await tx.userPreference.upsert({
    where: { userId_key: { userId, key: PRESET_ID_KEY } },
    update: { value },
    create: { userId, key: PRESET_ID_KEY, value },
  })
}

/** その利用者が決めている色（行が無い状態は画面が既定で埋める） */
export async function listUserScoringStatusColors(
  userId: string
): Promise<UserScoringStatusColor[]> {
  return prisma.userScoringStatusColor.findMany({ where: { userId } })
}

/** 1状態ぶんの色を書き、プリセットの記憶を外す */
export async function setUserScoringStatusColor(
  userId: string,
  status: string,
  colors: UserScoringStatusColorValues
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await upsertColor(tx, userId, { status, ...colors })
    await writePresetId(tx, userId, null)
  })
}

/** プリセットを当てる（状態ぶんの色と、選んだプリセットは同時に決まる） */
export async function applyUserScoringColorPreset(
  userId: string,
  presetId: string,
  colors: UserScoringStatusColorEntry[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const entry of colors) {
      await upsertColor(tx, userId, entry)
    }
    await writePresetId(tx, userId, presetId)
  })
}

async function upsertColor(
  tx: Prisma.TransactionClient,
  userId: string,
  entry: UserScoringStatusColorEntry
): Promise<void> {
  const { status, ...data } = entry
  const existing = await tx.userScoringStatusColor.findUnique({
    where: { userId_status: { userId, status } },
  })
  if (!existing) {
    await tx.userScoringStatusColor.create({
      data: { userId, status, ...data },
    })
    return
  }
  await updateRowIfChanged(existing, data, () =>
    tx.userScoringStatusColor.update({
      where: { userId_status: { userId, status } },
      data,
    })
  )
}
