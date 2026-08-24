import prisma from "./client"

/**
 * アプリ全体の設定（KV方式）の読み書き。
 *
 * 利用者ごとの好みは `userSettings.ts` の側。ここに置くのは **DB を共有する全員で
 * 同じであるべき決めごと**で、いまは年度の開始日だけである。
 */

/** 1キー分。行が無ければ null（呼び手が既定を決める） */
export async function getAppPreference(key: string): Promise<string | null> {
  const record = await prisma.appPreference.findUnique({ where: { key } })
  return record?.value ?? null
}

/**
 * 1キー分を書く。
 *
 * `key` は主キーではないので、別の端末が同じキーを同時に作ると id の違う行が2つできる。
 * 子を持たない表なので、同期はそれを後勝ちで畳める。
 */
export async function setAppPreference(
  key: string,
  value: string
): Promise<void> {
  await prisma.appPreference.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}
