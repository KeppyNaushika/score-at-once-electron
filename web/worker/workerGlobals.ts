/**
 * main の処理（Node 前提で書かれている）が、読み込んだ時点で当てにする大域変数を Worker に置く。
 *
 * Worker の入口（`backend.ts`）が最初に import する。ESM は import の順に評価されるので、
 * ここで置いた値は後から読み込む main のモジュールすべてから見える。
 */
import { Buffer } from "buffer"

import { WEB_DATA_DIRECTORY } from "./webPaths"

/** Node の `process` のうち、main のコードと束ねた依存が読む分 */
interface WorkerProcess {
  env: Record<string, string | undefined>
  platform: string
  versions: Record<string, string>
  argv: string[]
  cwd: () => string
  on: () => void
  once: () => void
  emitWarning: (warning: unknown) => void
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void
}

const workerProcess: WorkerProcess = {
  env: {
    NODE_ENV: "production",
    // データの根（`dataManager.ts` の getLocalDataDirectory）。デスクトップ版の e2e が
    // data を差し替えるのと同じ口で、web 版の仮想パスを指す
    SCORE_AT_ONCE_DATA_DIR: WEB_DATA_DIRECTORY,
  },
  platform: "browser",
  versions: {},
  argv: [],
  cwd: () => "/",
  on: () => {},
  once: () => {},
  emitWarning: (warning) => console.warn(warning),
  nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)),
}

Object.assign(globalThis, {
  // web 版で動いている印（`src/lib/webRuntime.ts`）。画面側も同じものを立てる
  scoreAtOnceWeb: true,
  process: workerProcess,
  Buffer,
  global: globalThis,
  setImmediate: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    setTimeout(callback, 0, ...args),
})
