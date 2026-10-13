import { WEB_APP_IMAGE_URL_PREFIX } from "@/lib/appImageUrl"

import {
  appImageContentTypeOf,
  appImageHeaders,
  appImageNotFound,
  isImageRequest,
  toDataDirectorySegments,
} from "./appImageResponse"

/**
 * web 版の画像を返す Service Worker。
 *
 * 画面は画像を `/__appimg/<データフォルダからの相対パス>` で読む（`src/lib/appImageUrl.ts`）。
 * デスクトップ版の `appimg` プロトコルハンドラ（`electron-src/index.ts`）と同じく、相対パスを
 * データフォルダの中のファイルとして読み、Content-Type を付けて返す。`/__appimg/` 以外の要求には
 * 手を出さない（ネットワークへそのまま流れる）。何を返し何を断るかは `appImageResponse.ts`:
 * データフォルダの外は返さない・ページとして開く要求には答えない・形式は画像に限る。
 *
 * ファイルの置き方は Worker の fs 差し替えと揃える（`web/worker/webPaths.ts`）: データフォルダは
 * 仮想パスの `/opfs/data`（OPFS の `data/`）。
 */

/** 画面（`web/page/entry.ts`）から届く頼みごと */
export type ServiceWorkerRequest = {
  /** 強制再読み込みなどで受け持ちが外れたタブを、受け持ち直す */
  kind: "claim"
}

// lib.dom と lib.webworker は同じプログラムに同居できないので、使う分だけ型を書く
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void
}

interface FetchEvent extends Event {
  request: Request
  respondWith(response: Promise<Response>): void
}

interface ExtendableMessageEvent extends ExtendableEvent {
  data: unknown
}

interface ServiceWorkerScope {
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  location: Location
  addEventListener(
    type: "install" | "activate",
    listener: (event: ExtendableEvent) => void
  ): void
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void
  addEventListener(
    type: "message",
    listener: (event: ExtendableMessageEvent) => void
  ): void
}

declare const self: ServiceWorkerScope

const isServiceWorkerRequest = (
  message: unknown
): message is ServiceWorkerRequest =>
  typeof message === "object" &&
  message !== null &&
  "kind" in message &&
  message.kind === "claim"

const readOpfsFile = async (segments: string[]): Promise<File> => {
  const directorySegments = segments.slice(0, -1)
  const fileName = segments[segments.length - 1]
  let directory = await navigator.storage.getDirectory()
  for (const segment of directorySegments) {
    directory = await directory.getDirectoryHandle(segment)
  }
  const fileHandle = await directory.getFileHandle(fileName)
  return fileHandle.getFile()
}

const respondWithImage = async (
  encodedPath: string,
  destination: RequestDestination
): Promise<Response> => {
  const segments = toDataDirectorySegments(encodedPath)
  if (!segments) return appImageNotFound()
  const contentType = appImageContentTypeOf(
    segments[segments.length - 1],
    destination
  )
  if (contentType === null) return appImageNotFound()
  try {
    const file = await readOpfsFile(segments)
    return new Response(file, {
      status: 200,
      headers: appImageHeaders(contentType, file.size),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return appImageNotFound()
    }
    console.error("[serviceWorker] 画像を読めませんでした", segments, error)
    return appImageNotFound()
  }
}

// 新しい版は待たせずに受け持つ。キャッシュを持たず、返すのは OPFS の画像だけなので、
// 古い版の画面を新しい版の Service Worker が受け持っても食い違うものが無い（画面と Worker の
// 版の食い違いは入口が見る。`web/webBuild.ts`）。新しい版は、再読み込みのときの `register` が
// HTTP のキャッシュを通さずに取りに行く
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("message", (event) => {
  if (isServiceWorkerRequest(event.data)) {
    event.waitUntil(self.clients.claim())
  }
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" && event.request.method !== "HEAD") return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return
  if (!requestUrl.pathname.startsWith(WEB_APP_IMAGE_URL_PREFIX)) return
  // ページとして開く要求には、静的配信へ流さず（画面の書き出しが返りうる）ここで断る
  if (!isImageRequest(event.request)) {
    event.respondWith(Promise.resolve(appImageNotFound()))
    return
  }
  event.respondWith(
    respondWithImage(
      requestUrl.pathname.slice(WEB_APP_IMAGE_URL_PREFIX.length),
      event.request.destination
    )
  )
})
