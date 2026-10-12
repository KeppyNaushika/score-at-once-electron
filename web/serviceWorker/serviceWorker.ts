import { WEB_APP_IMAGE_URL_PREFIX } from "@/lib/appImageUrl"

import { OPFS_VIRTUAL_ROOT, WEB_DATA_DIRECTORY } from "../worker/webPaths"

/**
 * web 版の画像を返す Service Worker。
 *
 * 画面は画像を `/__appimg/<データフォルダからの相対パス>` で読む（`src/lib/appImageUrl.ts`）。
 * デスクトップ版の `appimg` プロトコルハンドラ（`electron-src/index.ts`）と同じく、相対パスを
 * データフォルダの中のファイルとして読み、Content-Type を付けて返す。それ以外の要求には
 * 手を出さない（ネットワークへそのまま流れる）。
 *
 * ファイルの置き方は Worker の fs 差し替えと揃える（`web/worker/webPaths.ts`）: 仮想パス
 * `/opfs/<rest>` は OPFS のルート直下の `<rest>` で、データフォルダは `/opfs/data`（OPFS の `data/`）。
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

/** 仮想パスの絶対パスの頭。ここから先が OPFS のルートからのパス */
const OPFS_VIRTUAL_ROOT_PREFIX = `${OPFS_VIRTUAL_ROOT}/`

/** データフォルダの、OPFS のルートからの位置 */
const DATA_DIRECTORY_SEGMENTS = WEB_DATA_DIRECTORY.slice(
  OPFS_VIRTUAL_ROOT_PREFIX.length
).split("/")

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
}

const DEFAULT_CONTENT_TYPE = "application/octet-stream"

const contentTypeOf = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  return IMAGE_CONTENT_TYPES[extension] ?? DEFAULT_CONTENT_TYPE
}

const isServiceWorkerRequest = (
  message: unknown
): message is ServiceWorkerRequest =>
  typeof message === "object" &&
  message !== null &&
  "kind" in message &&
  message.kind === "claim"

/**
 * 画像 URL のパス（`/__appimg/` より後ろ）を、OPFS のルートからのパスの区切りにする。
 * データフォルダの外（`..`）は指させない
 */
const toOpfsSegments = (encodedPath: string): string[] | null => {
  let filePath: string
  try {
    filePath = decodeURIComponent(encodedPath)
  } catch {
    return null
  }
  // projects/ → exams/（v0.6.x のリネーム。デスクトップ版のハンドラと同じ）
  if (filePath.startsWith("projects/")) {
    filePath = "exams/" + filePath.slice("projects/".length)
  }
  // 仮想パスの絶対パスが来たら、OPFS のルートから辿る
  const isAbsolute = filePath.startsWith(OPFS_VIRTUAL_ROOT_PREFIX)
  const relativeSegments = (
    isAbsolute ? filePath.slice(OPFS_VIRTUAL_ROOT_PREFIX.length) : filePath
  )
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
  if (relativeSegments.length === 0 || relativeSegments.includes("..")) {
    return null
  }
  return isAbsolute
    ? relativeSegments
    : [...DATA_DIRECTORY_SEGMENTS, ...relativeSegments]
}

const notFound = () =>
  new Response("File not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })

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

const respondWithImage = async (encodedPath: string): Promise<Response> => {
  const segments = toOpfsSegments(encodedPath)
  if (!segments) return notFound()
  try {
    const file = await readOpfsFile(segments)
    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypeOf(file.name),
        "Content-Length": String(file.size),
        // 同じパスのまま中身を書き換えることがあるので、毎回読み直させる
        "Cache-Control": "no-store",
        // フレーム検出は crossOrigin="anonymous" で読む（デスクトップ版のハンドラと同じ）
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return notFound()
    }
    console.error("[serviceWorker] 画像を読めませんでした", segments, error)
    return notFound()
  }
}

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
  event.respondWith(
    respondWithImage(requestUrl.pathname.slice(WEB_APP_IMAGE_URL_PREFIX.length))
  )
})
