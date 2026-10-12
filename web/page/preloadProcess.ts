/**
 * web 版で、preload の束の中の `process` だけをこれに差し替える（esbuild の `inject`）。
 * 画面全体の `window.process` は作らない（Next や依存が `process` の有無で振る舞いを変えるため）。
 *
 * preload は `process.once("loaded", ...)` で隔離された世界の `global.ipcRenderer` を
 * 立てるだけで、画面からは見えない。デスクトップ版で画面に見えないものは web 版でも
 * 立てないので、受け付けて何もしない。
 */
export const process = {
  once(_eventName: string, _listener: () => void) {},
}
