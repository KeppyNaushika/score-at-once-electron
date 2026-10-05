/**
 * 「料金」タブの「ページから読み込む」の取得（main）。
 *
 * **main は取ってくるだけで、読み解かない。** 返すのは本文の文字列そのもので、表を探して
 * 単価を読むのは renderer（`src/app/(app)/ai-grading/utils/anthropicPricingPage.ts`）。
 *
 * 形式は Markdown を頼む（`Accept: text/markdown`）。2026-10 に確かめたところ、Anthropic の
 * 料金のページは同じ URL のまま、この見出しを付けると Markdown（表は `| … |` の行）を返し、
 * 付けないと 1MB 近い HTML を返した（URL の末尾に `.md` を足しても同じ Markdown が返るが、
 * 利用者が URL を変えたときに壊れやすいので、URL はそのまま使い見出しで頼む）。
 * HTML が返ってきたときは renderer が「表が見つからない」として読み込めなかったことにする。
 *
 * 学校のプロキシを通すため、事業者への通信と同じく Electron の `net.fetch` を使う
 * （`electronFetch`）。待つ時間と大きさに上限を置く。
 */

import type { ProviderFetch } from "./providers/types"

/** 待つ時間の上限 */
const PRICING_PAGE_TIMEOUT_MS = 20_000

/** 本文の大きさの上限（Markdown なら数十KB。HTML でも収まる程度に余裕を持たせる） */
const PRICING_PAGE_MAX_BYTES = 3 * 1024 * 1024

/** 読み込めなかった理由 */
export type PricingPageFetchFailure =
  "invalid_url" | "http_error" | "too_large" | "timeout" | "connection"

/** 取得の結果。失敗は投げずに種類で返す */
export type PricingPageFetchResult =
  | {
      outcome: "ok"
      url: string
      /** 取得した日時（ISO 8601） */
      fetchedAt: string
      contentType: string
      body: string
    }
  | { outcome: PricingPageFetchFailure; url: string; message: string }

interface PricingPageFetchDependencies {
  fetch: ProviderFetch
  now?: () => Date
}

/** 本文を上限まで読む。上限を超えたら null */
async function readBodyWithinLimit(response: Response): Promise<string | null> {
  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteCount = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    byteCount += value.byteLength
    if (byteCount > PRICING_PAGE_MAX_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf-8")
}

/** 料金のページを取ってくる（https だけ） */
export async function fetchPricingPage(
  url: string,
  dependencies: PricingPageFetchDependencies
): Promise<PricingPageFetchResult> {
  const now = dependencies.now ?? (() => new Date())
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { outcome: "invalid_url", url, message: "URL の形ではありません" }
  }
  if (parsedUrl.protocol !== "https:") {
    return {
      outcome: "invalid_url",
      url,
      message: "https の URL だけを読みます",
    }
  }

  const abortController = new AbortController()
  const timeout = setTimeout(
    () => abortController.abort(),
    PRICING_PAGE_TIMEOUT_MS
  )
  try {
    const response = await dependencies.fetch(parsedUrl.href, {
      headers: { Accept: "text/markdown, text/plain;q=0.9, */*;q=0.1" },
      signal: abortController.signal,
    })
    if (!response.ok) {
      return {
        outcome: "http_error",
        url,
        message: `ページが ${response.status} を返しました`,
      }
    }
    const body = await readBodyWithinLimit(response)
    if (body === null) {
      return {
        outcome: "too_large",
        url,
        message: "ページが大きすぎます",
      }
    }
    return {
      outcome: "ok",
      url,
      fetchedAt: now().toISOString(),
      contentType: response.headers.get("content-type") ?? "",
      body,
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      return {
        outcome: "timeout",
        url,
        message: "時間内に応答がありませんでした",
      }
    }
    return {
      outcome: "connection",
      url,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}
