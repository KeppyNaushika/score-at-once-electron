import type { PageToWorkerMessage, WorkerToPageMessage } from "../ipcProtocol"
import { OPFS_VIRTUAL_ROOT } from "../worker/webPaths"
import { printHtml } from "./htmlPrinter"
import { pickFiles } from "./openFilesPicker"

/**
 * web 版で、preload（`electron-src/preload.ts`。無改変）から見える `electron`。
 * 書き出し（`scripts/web/buildWeb.mjs`）が `electron` の import をこのファイルへ差し替える。
 *
 * `ipcRenderer` は main の処理を動かす module Worker と postMessage で話す（`web/ipcProtocol.ts`）。
 * Worker と Service Worker の準備が揃うまでに来た要求は溜めておき、入口（`entry.ts`）が
 * `openOutbox` を呼んだときに来た順のまま送る。
 */

/** Electron の `IpcRendererEvent` の代わり。preload の購読者は使っていない */
interface PushEvent {
  sender: null
}

type PushListener = (event: PushEvent, payload: unknown) => void

interface PendingInvoke {
  resolve: (reply: unknown) => void
  reject: (error: Error) => void
}

interface WorkerLifecycle {
  onReady: () => void
  onBootFailed: (message: string) => void
}

let worker: Worker | null = null
let outboxOpened = false
/** 起動に失敗した理由。立ったあとの invoke はすべて失敗させる */
let bootFailure: string | null = null
const outbox: PageToWorkerMessage[] = []
const pendingInvokes = new Map<number, PendingInvoke>()
const pushListeners = new Map<string, Set<PushListener>>()
let lastInvokeId = 0

const post = (message: PageToWorkerMessage) => {
  if (outboxOpened && worker) {
    worker.postMessage(message)
    return
  }
  outbox.push(message)
}

/** 保存ダイアログで選ばれた先へ Worker が書き終えたファイルを、ダウンロードとして渡す */
const downloadFile = (fileName: string, contents: Blob) => {
  const objectUrl = URL.createObjectURL(contents)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.style.display = "none"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // クリックの直後に失効させると、ダウンロードが始まる前に URL が消えることがある
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/** Worker の開くダイアログの代わりにファイルを選ばせ、仮想パスに結び付けて返す */
const openFiles = async (
  message: Extract<WorkerToPageMessage, { kind: "openFiles" }>
) => {
  let filePaths: string[] | null = null
  try {
    const files = await pickFiles(message.request)
    filePaths = files === null ? null : files.map(webUtils.getPathForFile)
  } catch (error) {
    console.error("[web] ファイルを選ばせられなかった:", error)
  }
  post({ kind: "filesOpened", requestId: message.requestId, filePaths })
}

/** Worker から頼まれた HTML を印刷する */
const printRequestedHtml = async (
  message: Extract<WorkerToPageMessage, { kind: "printHtml" }>
) => {
  let failure: string | null = null
  try {
    await printHtml(message.request)
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  post({ kind: "htmlPrinted", requestId: message.requestId, failure })
}

/**
 * Worker から頼まれた外部のページを新しいタブで開く。開くのは `https:` の URL だけで、
 * それ以外（`javascript:`・`data:`・`file:` 等や、URL として読めないもの）は開かずに警告を残す
 */
const openExternalHttps = (requestedUrl: string) => {
  const parsedUrl = URL.canParse(requestedUrl) ? new URL(requestedUrl) : null
  if (parsedUrl?.protocol !== "https:") {
    console.warn("https 以外の外部 URL は開きません:", requestedUrl)
    return
  }
  window.open(parsedUrl.href, "_blank", "noopener")
}

const receive = (message: WorkerToPageMessage, lifecycle: WorkerLifecycle) => {
  switch (message.kind) {
    case "reply": {
      pendingInvokes.get(message.id)?.resolve(message.value)
      pendingInvokes.delete(message.id)
      return
    }
    case "replyError": {
      pendingInvokes.get(message.id)?.reject(new Error(message.message))
      pendingInvokes.delete(message.id)
      return
    }
    case "push": {
      pushListeners
        .get(message.channel)
        ?.forEach((listener) => listener({ sender: null }, message.payload))
      return
    }
    case "openExternal": {
      openExternalHttps(message.url)
      return
    }
    case "download": {
      downloadFile(message.fileName, message.contents)
      return
    }
    case "openFiles": {
      void openFiles(message)
      return
    }
    case "printHtml": {
      void printRequestedHtml(message)
      return
    }
    case "ready": {
      lifecycle.onReady()
      return
    }
    case "bootFailed": {
      lifecycle.onBootFailed(message.message)
      return
    }
  }
}

/** 入口が起動した Worker をつなぐ。溜めた要求は `openOutbox` まで送らない */
export function attachWorker(
  startedWorker: Worker,
  lifecycle: WorkerLifecycle
) {
  worker = startedWorker
  startedWorker.addEventListener(
    "message",
    (event: MessageEvent<WorkerToPageMessage>) => receive(event.data, lifecycle)
  )
}

/** Worker と Service Worker の準備が揃った。溜めた要求を来た順に送る */
export function openOutbox() {
  if (!worker || bootFailure !== null) return
  outboxOpened = true
  outbox.splice(0).forEach((message) => worker?.postMessage(message))
}

/** 起動に失敗した。返事を待っている invoke と、これから来る invoke を失敗させる */
export function failBoot(message: string) {
  bootFailure = message
  outbox.length = 0
  pendingInvokes.forEach((pending) => pending.reject(new Error(message)))
  pendingInvokes.clear()
}

export const ipcRenderer = {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (bootFailure !== null) return Promise.reject(new Error(bootFailure))
    lastInvokeId += 1
    const id = lastInvokeId
    return new Promise((resolve, reject) => {
      pendingInvokes.set(id, { resolve, reject })
      post({ kind: "invoke", id, channel, args })
    })
  },
  send(channel: string, ...args: unknown[]) {
    if (bootFailure !== null) return
    post({ kind: "send", channel, args })
  },
  on(channel: string, listener: PushListener) {
    const listeners = pushListeners.get(channel) ?? new Set<PushListener>()
    listeners.add(listener)
    pushListeners.set(channel, listeners)
    return ipcRenderer
  },
  removeListener(channel: string, listener: PushListener) {
    pushListeners.get(channel)?.delete(listener)
    return ipcRenderer
  },
  removeAllListeners(channel: string) {
    pushListeners.delete(channel)
    return ipcRenderer
  },
}

export const contextBridge = {
  /** web 版には隔離された世界が無いので、画面の `window` へそのまま置く */
  exposeInMainWorld(apiKey: string, api: unknown) {
    Object.defineProperty(window, apiKey, {
      value: api,
      enumerable: true,
      configurable: false,
      writable: false,
    })
  },
}

/**
 * Worker 側でファイルを置く仮想パスの頭。Worker の fs 差し替えは仮想パス `/opfs/<rest>` を
 * OPFS のルート直下の `<rest>` に置くので、選ばれたファイルもこの下に置かれる
 */
const UPLOAD_DIR = `${OPFS_VIRTUAL_ROOT}/uploads`

export const webUtils = {
  /**
   * 選ばれたファイルに一意な仮想パスを付けて同期で返し、同時に `File` を Worker へ送る。
   * postMessage は送った順に届くので、このパスを使う invoke より先に Worker に着く
   */
  getPathForFile(file: File): string {
    const path = `${UPLOAD_DIR}/${crypto.randomUUID()}/${file.name}`
    post({ kind: "stageFile", path, file })
    return path
  },
}
