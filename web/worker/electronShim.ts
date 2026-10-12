/**
 * Worker 側の `electron`。main のハンドラ（`setupAllIPCHandlers`）が使う API だけを持つ。
 * 書き出し（`scripts/web/buildWorker.mjs`）が `electron` の import をこのファイルへ差し替える。
 *
 * ウィンドウは画面1枚だけで、`webContents.send` は画面への `push` になる
 * （`web/ipcProtocol.ts`）。画面を持たない処理（オフスクリーンのウィンドウ・utilityProcess）と、
 * 暗号化の口（safeStorage）は web 版では未対応。HTML の印刷は、オフスクリーンのウィンドウを
 * 使う窓口（`electron-src/lib/printUtils.ts`）ごと差し替える（`htmlPrinting.ts`）。
 */
import type { WorkerToPageMessage } from "../ipcProtocol"
import { createDownloadDirectory, createDownloadPath } from "./downloadArea"
import { requestOpenFiles } from "./pageRequests"
import { unsupportedExport } from "./unsupportedModule"
import {
  OPFS_VIRTUAL_ROOT,
  WEB_TEMP_DIRECTORY,
  WEB_USER_DATA_DIRECTORY,
} from "./webPaths"

/**
 * アプリの版と名前。書き出し（`scripts/web/buildWorker.mjs` の `define`）が package.json から
 * 埋め込む。package.json を丸ごと import すると依存の一覧まで Worker に入るので、要る2つだけを渡す
 */
declare const __APP_VERSION__: string
declare const __APP_NAME__: string

type IpcListener = (event: IpcEvent, ...args: unknown[]) => unknown

/** 画面の webContents のうち、main のコードが使う分 */
interface PageWebContents {
  id: number
  send(channel: string, payload: unknown): void
  isDestroyed(): boolean
  on(): PageWebContents
  once(): PageWebContents
  printToPDF(): never
  executeJavaScript(): never
}

/** ハンドラの第1引数。`event.sender` は画面 */
interface IpcEvent {
  sender: PageWebContents
}

interface DialogOptions {
  title?: string
  defaultPath?: string
  /** `showOpenDialog` の `properties`（openFile・openDirectory・multiSelections など） */
  properties: string[]
  /** `filters` の拡張子をすべて並べたもの（ドット無し）。`*` を含めば何でも */
  extensions: string[]
}

const postToPage = (message: WorkerToPageMessage) => postMessage(message)

const ipcHandlers = new Map<string, IpcListener>()

/** `ipcMain.handle` で登録されたハンドラ。Worker の入口が `invoke` から呼ぶ */
export function findIpcHandler(channel: string): IpcListener | null {
  return ipcHandlers.get(channel) ?? null
}

export const ipcMain = {
  handle(channel: string, listener: IpcListener): void {
    if (ipcHandlers.has(channel)) {
      throw new Error(`Attempted to register a second handler for '${channel}'`)
    }
    ipcHandlers.set(channel, listener)
  },
  removeHandler(channel: string): void {
    ipcHandlers.delete(channel)
  },
  on(): void {},
  once(): void {},
}

/**
 * 画面の webContents。成績算出のロック（`gradeLockHandlers.ts`）が持ち主の印に `id` を、
 * 画面の移動・破棄の通知に `on`/`once` を使う。web 版では画面の再読み込みで Worker ごと
 * 終わるので、通知は来ない（ロックも Worker と一緒に消える）
 */
const pageWebContents: PageWebContents = {
  id: 1,
  send(channel: string, payload: unknown): void {
    postToPage({ kind: "push", channel, payload })
  },
  isDestroyed: () => false,
  on: () => pageWebContents,
  once: () => pageWebContents,
  printToPDF: unsupportedExport("electron", "webContents.printToPDF"),
  executeJavaScript: unsupportedExport(
    "electron",
    "webContents.executeJavaScript"
  ),
}

/** 画面のウィンドウ。全画面は画面側の操作（ユーザーの操作が要る）なので Worker からは変えない */
const pageWindow = {
  id: 1,
  webContents: pageWebContents,
  isDestroyed: (): boolean => false,
  isFullScreen: (): boolean => false,
  setFullScreen(enabled: boolean): void {
    console.warn(`[web] 全画面の切り替え（${enabled}）は Worker からはできない`)
  },
  on(): void {},
}

/** ハンドラに渡す `event`（Worker の入口が使う） */
export function createIpcEvent(): IpcEvent {
  return { sender: pageWebContents }
}

/** 画面を持つウィンドウは1枚だけ。新しく作る（オフスクリーンの印刷・描画）のは未対応 */
export class BrowserWindow {
  static getAllWindows() {
    return [pageWindow]
  }

  static getFocusedWindow() {
    return pageWindow
  }

  static fromWebContents() {
    return pageWindow
  }

  constructor() {
    throw new Error(
      "[web] electron.BrowserWindow（オフスクリーンでの印刷・描画）は web 版では未対応"
    )
  }
}

const APP_PATHS: Record<string, string> = {
  userData: WEB_USER_DATA_DIRECTORY,
  appData: WEB_USER_DATA_DIRECTORY,
  temp: WEB_TEMP_DIRECTORY,
  exe: `${OPFS_VIRTUAL_ROOT}/score-at-once`,
  home: OPFS_VIRTUAL_ROOT,
}

export const app = {
  isPackaged: true,
  getPath(name: string): string {
    const resolvedPath = APP_PATHS[name]
    if (resolvedPath === undefined) {
      throw new Error(`[web] app.getPath("${name}") は web 版では未対応`)
    }
    return resolvedPath
  },
  getVersion: (): string => __APP_VERSION__,
  getName: (): string => __APP_NAME__,
  getAppPath: (): string => "/",
  relaunch(): void {
    console.warn(
      "[web] app.relaunch は web 版では未対応（ページを再読み込みする）"
    )
  },
  quit(): void {
    console.warn("[web] app.quit は web 版では未対応")
  },
  on(): void {},
  whenReady: (): Promise<void> => Promise.resolve(),
}

const stringsOf = (candidate: unknown): string[] =>
  Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === "string")
    : []

/** `filters`（`{ name, extensions }[]`）の拡張子をすべて並べる */
const filterExtensionsOf = (filters: unknown): string[] =>
  Array.isArray(filters)
    ? filters.flatMap((filter: unknown) =>
        typeof filter === "object" && filter !== null && "extensions" in filter
          ? stringsOf(filter.extensions)
          : []
      )
    : []

/** ダイアログの引数は `(options)` と `(window, options)` の2通り */
const dialogOptionsOf = (args: unknown[]): DialogOptions => {
  const options = args.at(-1)
  if (typeof options !== "object" || options === null) {
    return { properties: [], extensions: [] }
  }
  return {
    title:
      "title" in options && typeof options.title === "string"
        ? options.title
        : undefined,
    defaultPath:
      "defaultPath" in options && typeof options.defaultPath === "string"
        ? options.defaultPath
        : undefined,
    properties: "properties" in options ? stringsOf(options.properties) : [],
    extensions: "filters" in options ? filterExtensionsOf(options.filters) : [],
  }
}

export const dialog = {
  /**
   * 保存先を選ぶ代わりに、保存ダイアログの領域の仮想パスを返す。そこへ書き終えた
   * ファイルは画面へダウンロードとして渡る（`downloadArea.ts`）
   */
  async showSaveDialog(...args: unknown[]) {
    return {
      canceled: false,
      filePath: createDownloadPath(dialogOptionsOf(args).defaultPath),
    }
  },
  /**
   * ファイルは画面に選ばせる（`openFiles`。選ばれた `File` は `stageFile` と同じく仮想パスに
   * 結び付く）。
   *
   * フォルダ（`openDirectory`）は選ばせず、保存の領域のディレクトリを返す。ブラウザでは
   * 選んだフォルダへ書けないので、その下へ書いたファイルは1つずつダウンロードとして渡る。
   * 開くダイアログでフォルダを選ぶ経路は、どれも書き出し先を決めるもの（PDF の分割・PNG の
   * 書き出しの保存先）で、フォルダの中身を読む経路は無い（共有フォルダの選択は同期の経路で、
   * web 版では扱わない）
   */
  async showOpenDialog(...args: unknown[]) {
    const options = dialogOptionsOf(args)
    if (options.properties.includes("openDirectory")) {
      return { canceled: false, filePaths: [createDownloadDirectory()] }
    }
    const filePaths = await requestOpenFiles({
      title: options.title ?? null,
      multiple: options.properties.includes("multiSelections"),
      extensions:
        options.extensions.length === 0 || options.extensions.includes("*")
          ? null
          : options.extensions,
    })
    if (filePaths === null || filePaths.length === 0) {
      return { canceled: true, filePaths: [] }
    }
    return { canceled: false, filePaths }
  },
  async showMessageBox(...args: unknown[]) {
    const options = dialogOptionsOf(args)
    console.warn(`[web] dialog.showMessageBox: ${options.title ?? ""}`)
    return { response: 0, checkboxChecked: false }
  },
  showErrorBox(title: string, content: string): void {
    console.error(`[web] ${title}: ${content}`)
  },
}

export const shell = {
  async openExternal(url: string): Promise<void> {
    postToPage({ kind: "openExternal", url })
  },
  async openPath(filePath: string): Promise<string> {
    return `[web] ${filePath} を開くことは web 版では未対応`
  },
  showItemInFolder(): void {},
}

export const net = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
}

/**
 * web 版には OS の鍵束が無く、API キーを暗号化して保存できない。
 * `isEncryptionAvailable` が false なので、AI の事業者設定（`providerCredentialStore.ts`）は
 * 「この環境では API キーを暗号化して保存できないため、保存しません」と断る
 */
export const safeStorage = {
  isEncryptionAvailable: (): boolean => false,
  encryptString: unsupportedExport("electron", "safeStorage.encryptString"),
  decryptString: unsupportedExport("electron", "safeStorage.decryptString"),
}

const startedPowerSaveBlockers = new Set<number>()
let lastPowerSaveBlockerId = 0

/** 画面の消灯を止める口。Worker からは止められないので、状態だけ持つ */
export const powerSaveBlocker = {
  start(): number {
    lastPowerSaveBlockerId += 1
    startedPowerSaveBlockers.add(lastPowerSaveBlockerId)
    return lastPowerSaveBlockerId
  },
  stop(blockerId: number): void {
    startedPowerSaveBlockers.delete(blockerId)
  },
  isStarted: (blockerId: number): boolean =>
    startedPowerSaveBlockers.has(blockerId),
}

export const utilityProcess = {
  fork: unsupportedExport("electron", "utilityProcess.fork"),
}
