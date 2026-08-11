import { ipcRenderer } from "electron"

import type { Serialized } from "@/types/prismaExtensions"

import type { Handlers } from "../ipc-handlers"
import { isIpcEnvelope } from "../ipc-handlers/ipcEnvelope"

/**
 * `ipcRenderer.invoke` の唯一の入口。
 *
 * 境界（`registerChannel`）が詰めた搬送形式をほどき、失敗は例外へ戻す。
 * renderer には payload だけが届き、`{ success, error }` を見に行く必要はない。
 *
 * 引数と戻り値は main の登録簿（`Handlers`）から導く。契約を renderer 側で
 * 宣言し直さないので、ハンドラの署名を変えると呼び出し側がコンパイルエラーになる。
 * 戻り値に `Serialized<>` を掛けるのは、境界が `serializePrisma` を通すため
 * （Decimal → number。それ以外の型では恒等）。
 *
 * `Handlers` は**型としてのみ** import する。値として main を引くと esbuild が
 * main の依存グラフ（@prisma/client・ネイティブモジュール）を preload バンドルへ
 * 引き込んでビルドが壊れる。
 */
export const invoke = async <Channel extends keyof Handlers>(
  channel: Channel,
  ...args: Parameters<Handlers[Channel]>
): Promise<Serialized<Awaited<ReturnType<Handlers[Channel]>>>> => {
  const result: unknown = await ipcRenderer.invoke(channel, ...args)

  if (!isIpcEnvelope(result)) {
    return result as Serialized<Awaited<ReturnType<Handlers[Channel]>>>
  }
  if (result.__ipc === "failed") throw new Error(result.error)

  return result.value as Serialized<Awaited<ReturnType<Handlers[Channel]>>>
}

/**
 * チャンネルをそのまま renderer のメソッドにする。
 *
 * 引数を素通しするだけのメソッド（preload の大半）はこれで足りる。手で引数の型を
 * 書き写さないので、ハンドラの署名を変えたときに preload だけ古い形のまま残ることが
 * 起きない（実際、型付き `invoke` を入れた時点で書き写しのズレが4件見つかった）。
 *
 * 引数の並び替え・既定値の補完・戻り値の加工が要るメソッドは素直にアロー関数で書く。
 */
export const bind =
  <Channel extends keyof Handlers>(channel: Channel) =>
  (...args: Parameters<Handlers[Channel]>) =>
    invoke(channel, ...args)
