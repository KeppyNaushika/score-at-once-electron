/**
 * 「ページから読み込む」の取得（main）。本文をそのまま返し、読み解かない。
 * 実際のネットワークには出ない（偽の fetch を渡す）。
 */

import { describe, expect, it, vi } from "vitest"

import { fetchPricingPage } from "../../electron-src/lib/aiGrading/pricingPageFetch"

const NOW = () => new Date("2026-10-05T00:00:00.000Z")

describe("fetchPricingPage", () => {
  it("Markdown を頼み、本文をそのまま返す", async () => {
    const fakeFetch = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response("| Model | x |", {
          status: 200,
          headers: { "content-type": "text/markdown; charset=utf-8" },
        })
    )
    const result = await fetchPricingPage("https://example.test/pricing", {
      fetch: fakeFetch,
      now: NOW,
    })
    expect(result).toEqual({
      outcome: "ok",
      url: "https://example.test/pricing",
      fetchedAt: "2026-10-05T00:00:00.000Z",
      contentType: "text/markdown; charset=utf-8",
      body: "| Model | x |",
    })
    const init = fakeFetch.mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get("Accept")).toContain("text/markdown")
  })

  it("https でない URL は取りに行かない", async () => {
    const fakeFetch = vi.fn()
    const result = await fetchPricingPage("http://example.test/pricing", {
      fetch: fakeFetch,
    })
    expect(result.outcome).toBe("invalid_url")
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it("失敗は投げずに種類で返す（HTTP の失敗・大きすぎる本文・つながらない）", async () => {
    expect(
      (
        await fetchPricingPage("https://example.test/pricing", {
          fetch: async () => new Response("no", { status: 404 }),
        })
      ).outcome
    ).toBe("http_error")
    expect(
      (
        await fetchPricingPage("https://example.test/pricing", {
          fetch: async () => new Response("x".repeat(4 * 1024 * 1024)),
        })
      ).outcome
    ).toBe("too_large")
    expect(
      (
        await fetchPricingPage("https://example.test/pricing", {
          fetch: async () => {
            throw new Error("offline")
          },
        })
      ).outcome
    ).toBe("connection")
  })
})
