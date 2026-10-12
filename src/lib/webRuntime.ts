/**
 * web 版で動いているかを見分ける。
 *
 * 画面の静的書き出しも main のコードも、デスクトップ版と web 版で同じものを使うので、
 * ビルド時ではなく実行時に、web 版の入口が立てる大域の `scoreAtOnceWeb` で見分ける。
 * 画面（`web/page/entry.ts`）と、main の処理を動かす Worker（`web/worker/workerGlobals.ts`）の
 * 両方が立てる。
 */

declare global {
  /** web 版の入口（画面と Worker）が立てる。デスクトップ版では無い */
  var scoreAtOnceWeb: true | undefined
}

export const isWebRuntime = (): boolean => globalThis.scoreAtOnceWeb === true
