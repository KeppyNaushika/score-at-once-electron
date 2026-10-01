/**
 * 採点状態ごとの表示色の読み書き。
 *
 * 持ち方は**土台のプリセット1つ＋状態ごとの上書き**。
 * - 土台: `UserPreference` の `scoringColorPresetId`（プリセットの id だけ。色は持たない）
 * - 上書き: `UserScoringStatusColor` の行（**個別に触った状態の分だけ在る**）
 *
 * かつては `UserPreference` の1キーに7状態ぶんの JSON を丸ごと入れていた。塊で読み書き
 * すると、**続けて2色変えたときに先の1色が消える**（取り直しが着地する前に、古い写しへ
 * 2度目を重ねて書くため）。行へ割れば別々の行を書くので、その競合そのものが無くなる。
 *
 * 行へ割ったあとも、**プリセットを当てる操作が全状態の色行を書き直していた**。1回の操作で
 * 7行の `updatedAt` が進むので、同期の行ごとの LWW が**組ごとの LWW に退化する**：別の
 * 端末が個別に直していた色は、そちらのほうが新しくてもプリセットに巻き取られて消えた。
 * 土台だけを書く形にすれば、プリセットの選択は1行・個別の色は1行で、互いに重ならない。
 *
 * **プリセットの色の中身は画面側（`src/lib/scoringStatusColors.ts`）が持つ。** ここが
 * 持つのは選んだ id だけで、表示のたびに id から色を引く。
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

/**
 * どの配色プリセットを土台に選んでいるか。
 *
 * 置き場所は `UserPreference`（1つの値で、割る先が無い）。**個別の色を触っても外さない**
 * — 土台はそのままで、その状態だけが上書きされた、と読む。外して回ると、土台にしていた
 * プリセットの色が他の状態ぶんまで既定へ戻ってしまう。
 */
const PRESET_ID_KEY = "scoringColorPresetId"

/** その利用者が個別に上書きしている色（行が無い状態は土台のプリセットの色） */
export async function listUserScoringStatusColors(
  userId: string
): Promise<UserScoringStatusColor[]> {
  return prisma.userScoringStatusColor.findMany({ where: { userId } })
}

/**
 * 1状態ぶんの色を上書きする。**触るのはその状態の1行だけ。**
 *
 * トランザクションで囲まない（1行しか書かないので、揃えるべき相手が無い）。
 */
export async function setUserScoringStatusColor(
  userId: string,
  status: string,
  colors: UserScoringStatusColorValues
): Promise<void> {
  const existing = await prisma.userScoringStatusColor.findUnique({
    where: { userId_status: { userId, status } },
  })
  if (!existing) {
    await prisma.userScoringStatusColor.create({
      data: { userId, status, ...colors },
    })
    return
  }
  await updateRowIfChanged(existing, { ...colors }, () =>
    prisma.userScoringStatusColor.update({
      where: { userId_status: { userId, status } },
      data: colors,
    })
  )
}

/**
 * プリセットを土台に据える。**まとまりを選ぶ操作**なので、個別の上書きは捨てる。
 *
 * 土台を据えることと上書きを捨てることは同時に決まるので、1つのトランザクションで行う
 * — 別々に書くと、選んだプリセットの色が一部の状態だけ前の上書きに隠れて見える。
 *
 * 捨てるのは**その端末が持っている上書き**だけ。他の端末がこのあと（＝より新しい版で）
 * 付けた上書きは、同期の行ごとの LWW で残る。プリセットは土台であって、他の端末の
 * 手元の作業を遡って消すものではない。
 */
export async function applyUserScoringColorPreset(
  userId: string,
  presetId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.userScoringStatusColor.deleteMany({ where: { userId } })
    await writePresetId(tx, userId, presetId)
  })
}

async function writePresetId(
  tx: Prisma.TransactionClient,
  userId: string,
  presetId: string
): Promise<void> {
  // 保存文字列の形は renderer の `serializePreference`（string? は JSON でくるむ）に合わせる
  const value = JSON.stringify(presetId)
  await tx.userPreference.upsert({
    where: { userId_key: { userId, key: PRESET_ID_KEY } },
    update: { value },
    create: { userId, key: PRESET_ID_KEY, value },
  })
}
