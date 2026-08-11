import { ipcRenderer } from "electron"

import { isIpcEnvelope } from "../ipc-handlers/ipcEnvelope"

/**
 * 型付けされていない `ipcRenderer.invoke` の唯一の入口。
 *
 * 境界（`registerHandler`）が詰めた搬送形式をほどき、失敗は例外へ戻す。
 * renderer には payload だけが届き、`{ success, error }` を見に行く必要はない。
 *
 * まだ境界を通っていない生 `ipcMain.handle` のチャンネル（`event` を第1引数に取る
 * 17本）は素の値を返すため、エンベロープでなければそのまま通す。
 *
 * 戻り値の型は現時点では契約 `src/types/electron/*.d.ts` が持つ。将来 main の
 * 実装から導出する（docs/ipc-and-data-fetching-plan.md 段階5）。
 */
export const invoke = async (
  channel: string,
  ...args: unknown[]
): Promise<unknown> => {
  const result: unknown = await ipcRenderer.invoke(channel, ...args)

  if (!isIpcEnvelope(result)) return result
  if (result.__ipc === "failed") throw new Error(result.error)

  return result.value
}
