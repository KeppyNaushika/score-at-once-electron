import { ipcRenderer } from "electron"

/**
 * main が押し出してくるチャンネルを購読する。外すのは戻り値を呼ぶ。
 *
 * 押し出しはどれも「出来事を1つ受け取って callback へ渡す」だけなので、張り方と
 * 外し方をここ1か所に置く。
 */
export function subscribe<Payload>(
  channel: string,
  callback: (payload: Payload) => void
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: Payload) =>
    callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}
