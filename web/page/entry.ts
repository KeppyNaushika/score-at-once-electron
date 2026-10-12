import "../../electron-src/preload"

import type { ServiceWorkerRequest } from "../serviceWorker/serviceWorker"
import { attachWorker, failBoot, openOutbox } from "./electronShim"
import { SERVICE_WORKER_PATH, WORKER_SCRIPT_PATH } from "./webAssetPaths"

/**
 * web 版の画面の入口。すべての HTML の `<head>` の先頭に、Next のスクリプトより先に
 * 同期で読み込まれる（`scripts/web/buildWeb.mjs`）。
 *
 * 1. preload（無改変）を読み込み、`window.electronAPI` を立てる（上の import）
 * 2. web 版で動いていることを画面に知らせる（`src/lib/webRuntime.ts`）
 * 3. DB を1タブで専有するためのロックを取り、取れたら main の処理を動かす Worker を起動する
 * 4. 画像を返す Service Worker がこのタブを受け持ち、Worker の準備が済んだら、溜めた要求を送る
 *
 * 画面（Next）は 1 を待つだけで描き始め、データの要求は 4 まで待たされる。画像の URL は
 * データが届いてから組み立てられるので、Service Worker が受け持つ前に画像を読みに行くことは無い。
 */

globalThis.scoreAtOnceWeb = true

/**
 * DB（opfs-sahpool）はファイルを1タブで専有する。2つ目のタブで Worker を起動すると
 * 開けずに失敗するので、その前にこのロックで止める
 */
const DATABASE_LOCK_NAME = "score-at-once-database"

/** 画面の上に、起動できない理由を出す */
const showBlockingNotice = (title: string, detail: string) => {
  const render = () => {
    const notice = document.createElement("div")
    notice.setAttribute("role", "alert")
    notice.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:12px;padding:24px;" +
      "background:rgba(255,255,255,0.97);color:#111;font:16px/1.6 sans-serif;text-align:center"
    const heading = document.createElement("p")
    heading.style.cssText = "font-size:20px;font-weight:bold;margin:0"
    heading.textContent = title
    const paragraph = document.createElement("p")
    paragraph.style.cssText = "margin:0;white-space:pre-wrap;max-width:40em"
    paragraph.textContent = detail
    notice.append(heading, paragraph)
    document.body.append(notice)
  }
  if (document.body) {
    render()
    return
  }
  document.addEventListener("DOMContentLoaded", render, { once: true })
}

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * 起動できないときに添える案内。起動の失敗（migration の失敗は控えから戻してから止まる）で
 * データは消えないが、利用者が直そうとしてサイトのデータを消すと、そこで本当に失われる
 */
const DATA_KEPT_NOTE =
  "データはこのブラウザの中に残っています。ブラウザのサイトデータは消さずに、" +
  "時間をおいて開き直してください。"

const failWithNotice = (message: string) => {
  failBoot(message)
  showBlockingNotice(
    "Score at Once を起動できませんでした",
    `${message}\n\n${DATA_KEPT_NOTE}`
  )
}

/**
 * 画像を返す Service Worker がこのタブを受け持つまで待つ。初めて開いたときは登録してから
 * 受け持ちが始まるまで、強制再読み込み（受け持ちを外して読み直す）のあとは受け持ち直しを頼んで待つ
 */
const waitForServiceWorkerControl = async () => {
  const serviceWorkers = navigator.serviceWorker
  if (!serviceWorkers) {
    throw new Error("このブラウザでは Service Worker を使えません。")
  }
  const controlled = new Promise<void>((resolve) => {
    if (serviceWorkers.controller) {
      resolve()
      return
    }
    serviceWorkers.addEventListener("controllerchange", () => resolve(), {
      once: true,
    })
  })
  await serviceWorkers.register(SERVICE_WORKER_PATH, { scope: "/" })
  const registration = await serviceWorkers.ready
  if (!serviceWorkers.controller) {
    const claimRequest: ServiceWorkerRequest = { kind: "claim" }
    registration.active?.postMessage(claimRequest)
  }
  await controlled
}

/** Worker を起動し、`ready` まで待つ。起動に失敗したら理由を出す */
const startWorker = () =>
  new Promise<void>((resolve, reject) => {
    const worker = new Worker(WORKER_SCRIPT_PATH, { type: "module" })
    worker.addEventListener("error", (event) => {
      reject(
        new Error(
          `処理を動かす Worker を読み込めませんでした（${event.message || WORKER_SCRIPT_PATH}）。`
        )
      )
    })
    let workerReady = false
    attachWorker(worker, {
      onReady: () => {
        workerReady = true
        resolve()
      },
      onBootFailed: (message) => {
        // 準備が済んだあとに届いた失敗は、待っている側がもういないのでここで出す
        if (workerReady) {
          failWithNotice(message)
          return
        }
        reject(new Error(message))
      },
    })
  })

const boot = async () => {
  const serviceWorkerControl = waitForServiceWorkerControl()
  // 待つ前に拒否されると未処理の拒否になるので、ここで受けておく
  serviceWorkerControl.catch(() => undefined)

  if (!navigator.locks) {
    // 対応していないブラウザ。開き直しても変わらないので、データの案内は添えない
    failBoot("このブラウザでは Web Locks を使えません。")
    showBlockingNotice(
      "Score at Once を起動できませんでした",
      "このブラウザでは Web Locks を使えません。"
    )
    return
  }
  await navigator.locks.request(
    DATABASE_LOCK_NAME,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        failBoot("別のタブで Score at Once が開いています。")
        showBlockingNotice(
          "別のタブで Score at Once が開いています",
          "データは1つのタブでしか開けません。開いているタブを使うか、そのタブを閉じてからこのタブを再読み込みしてください。"
        )
        return
      }
      try {
        await Promise.all([serviceWorkerControl, startWorker()])
        openOutbox()
      } catch (error) {
        failWithNotice(describeError(error))
      }
      // タブが開いている間はロックを持ち続ける（タブを閉じると放される）
      await new Promise<never>(() => undefined)
    }
  )
}

void boot()
