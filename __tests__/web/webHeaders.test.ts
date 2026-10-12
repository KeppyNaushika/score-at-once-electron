/**
 * web 版の配信のヘッダー（`scripts/web/webHeaders.mjs`）の固定。
 *
 * 原則「ホストは何も受け取らない・何も送らない」をヘッダーでも縛る。
 * - 画面の CSP は外へ接続させず、`eval` を許さず、インラインのスクリプトはハッシュで
 *   許したものだけ
 * - `eval` を許すのは main の処理を動かす Worker だけで、全体の CSP と重ならない
 *   （重なると両方が効いて Worker の `eval` が止まる）
 * - 違反の報告先を持たない
 */
import * as crypto from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  addPageHeadElements,
  headersForPath,
  inlineScriptTexts,
  pageContentSecurityPolicy,
  renderHeadersFile,
} from "../../scripts/web/webHeaders.mjs"

/** CSP の値を、指令の名前 → 許すものの並びにする */
function parsePolicy(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter((tokens) => tokens[0] !== "")
      .map(([directiveName, ...sources]): [string, string[]] => [
        directiveName,
        sources,
      ])
  )
}

/** 画面の HTML のあらまし（Next の書き出しと同じく、インラインのスクリプトを2つ持つ） */
const SAMPLE_HTML = [
  '<!DOCTYPE html><html lang="ja"><head><meta charSet="utf-8"/>',
  '<script src="/_next/static/chunks/main.js" async=""></script>',
  '<script async="" src="/js/mathJaxConfig.js"></script>',
  "</head><body>",
  "<script>(self.__next_f=self.__next_f||[]).push([0])</script>",
  '<script>self.__next_f.push([1,"page"])</script>',
  "</body></html>",
].join("")

const sha256Source = (scriptText: string) =>
  `'sha256-${crypto.createHash("sha256").update(scriptText, "utf8").digest("base64")}'`

/** 外のオリジンを指す書き方（スキームの付いた URL・ワイルドカード・ホスト名） */
const EXTERNAL_SOURCE = /^(https?:|wss?:|\*|[a-z0-9-]+\.[a-z])/i

describe("画面の HTML に差し込む CSP の meta", () => {
  const injected = addPageHeadElements(SAMPLE_HTML, {
    pageScriptPath: "/__web/page.js",
  })

  it("meta が <head> の一番前、その次に入口があり、どのスクリプトよりも前にある", () => {
    expect(injected).toMatch(
      /^<!DOCTYPE html><html lang="ja"><head><meta http-equiv="Content-Security-Policy" content="[^"]*"\/><script src="\/__web\/page\.js"><\/script><meta charSet="utf-8"\/>/
    )
    expect(injected.indexOf("Content-Security-Policy")).toBeLessThan(
      injected.indexOf("<script")
    )
  })

  it("インラインのスクリプトはその HTML のもののハッシュだけを許し、'unsafe-inline' も eval も許さない", () => {
    const policyText = injected.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
    )?.[1]
    expect(policyText).toBeDefined()
    const scriptSources = parsePolicy(policyText ?? "").get("script-src")
    expect(scriptSources).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      sha256Source("(self.__next_f=self.__next_f||[]).push([0])"),
      sha256Source('self.__next_f.push([1,"page"])'),
    ])
  })

  it("src のある <script> はハッシュに数えない", () => {
    expect(inlineScriptTexts(injected)).toEqual([
      "(self.__next_f=self.__next_f||[]).push([0])",
      'self.__next_f.push([1,"page"])',
    ])
  })

  it("<head> の無い HTML は止める", () => {
    expect(() =>
      addPageHeadElements("<html><body></body></html>", {
        pageScriptPath: "/__web/page.js",
      })
    ).toThrow()
  })
})

describe("CSP は外へ接続させず、報告も送らない", () => {
  const policies = [
    ["画面の meta", pageContentSecurityPolicy(["'sha256-AAAA'"])],
    ["全体のヘッダー", headersForPath("/")["Content-Security-Policy"]],
    [
      "Worker のヘッダー",
      headersForPath("/__web/worker/worker.js")["Content-Security-Policy"],
    ],
  ] as const

  it.each(policies)("%s", (_, policy) => {
    const directives = parsePolicy(policy)
    expect(directives.get("default-src")).toEqual(["'self'"])
    expect(directives.get("object-src")).toEqual(["'none'"])
    expect(directives.get("base-uri")).toEqual(["'none'"])
    expect(directives.has("report-uri")).toBe(false)
    expect(directives.has("report-to")).toBe(false)
    const externalSources = [...directives.values()]
      .flat()
      .filter((source) => EXTERNAL_SOURCE.test(source))
    expect(externalSources).toEqual([])
  })
})

describe("ヘッダーの当て方（`_headers` と手元の配信で同じ）", () => {
  it("画面とその他のファイルは eval を許さず、埋め込みも許さない", () => {
    const headers = headersForPath(
      "/exams/0b6c1d3e-0000-4000-8000-000000000000"
    )
    const directives = parsePolicy(headers["Content-Security-Policy"])
    expect(directives.get("script-src")).not.toContain("'unsafe-eval'")
    expect(directives.get("frame-ancestors")).toEqual(["'none'"])
    expect(headers["X-Frame-Options"]).toBe("DENY")
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["Referrer-Policy"]).toBe("no-referrer")
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin")
    expect(headers["Cross-Origin-Embedder-Policy"]).toBe("require-corp")
    expect(headers["Cache-Control"]).toBe("no-cache")
  })

  it("名前にハッシュの入った Next の資源だけは長く持たせ、ほかは毎回確かめさせる", () => {
    expect(
      headersForPath("/_next/static/chunks/main.js")["Cache-Control"]
    ).toBe("public, max-age=31536000, immutable")
    expect(headersForPath("/__web/page.js")["Cache-Control"]).toBe("no-cache")
    expect(headersForPath("/serviceWorker.js")["Cache-Control"]).toBe(
      "no-cache"
    )
  })

  it("Worker の CSP は1つだけで（全体の CSP と重ならず）、eval と wasm を許す", () => {
    const policy = headersForPath("/__web/worker/worker.js")[
      "Content-Security-Policy"
    ]
    expect(policy).not.toContain(",")
    const scriptSources = parsePolicy(policy).get("script-src")
    expect(scriptSources).toEqual(
      expect.arrayContaining(["'unsafe-eval'", "'wasm-unsafe-eval'"])
    )
    // COOP/COEP などは全体の規則から引き継ぐ
    expect(
      headersForPath("/__web/worker/vips-es6.js")[
        "Cross-Origin-Embedder-Policy"
      ]
    ).toBe("require-corp")
  })

  it("アプリが使うブラウザの機能（全画面・画面消灯の抑止・クリップボード）は塞がない", () => {
    const permissionsPolicy = headersForPath("/")["Permissions-Policy"]
    expect(permissionsPolicy).toContain("screen-wake-lock=(self)")
    expect(permissionsPolicy).toContain("fullscreen=(self)")
    expect(permissionsPolicy).toContain("clipboard-read=(self)")
    expect(permissionsPolicy).toContain("clipboard-write=(self)")
    expect(permissionsPolicy).toContain("camera=()")
  })

  it("_headers は Worker の規則で全体の CSP を外してから付け直す", () => {
    const headersFile = renderHeadersFile()
    expect(headersFile).toContain(
      "/__web/worker/*\n  ! Content-Security-Policy\n  Content-Security-Policy: "
    )
    expect(headersFile.indexOf("/*\n")).toBeLessThan(
      headersFile.indexOf("/__web/worker/*\n")
    )
  })
})
