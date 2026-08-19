/**
 * IPC の境界を越えるための搬送形式。
 *
 * 例外はプロセスを跨げない（`ipcMain.handle` の reject は renderer 側で
 * "Error invoking remote method ..." に潰れる）ため、境界で値へ詰め替え、
 * preload の `invoke` で例外へ戻す。main の `lib/` と renderer からは見えない。
 *
 * 旧来 payload が持つ `{ success, error }` とはキーを変えてある。同じキーだと、
 * まだ payload 側にエンベロープを持つ移行中のチャンネルと区別がつかない。
 *
 * 詳細は docs/ipc-and-data-fetching-plan.md。
 */

type IpcEnvelope<TValue> =
  { __ipc: "ok"; value: TValue } | { __ipc: "failed"; error: string }

/**
 * 搬送形式かどうかを判定する。
 *
 * まだ境界（`registerHandler`）を通っていない生 `ipcMain.handle` のチャンネルは
 * 素の値を返すため、preload 側で区別する必要がある。
 */
export const isIpcEnvelope = (
  value: unknown
): value is IpcEnvelope<unknown> => {
  if (typeof value !== "object" || value === null || !("__ipc" in value)) {
    return false
  }
  return value.__ipc === "ok" || value.__ipc === "failed"
}

/** 例外から利用者に見せる文言を取り出す */
export const toIpcErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback
