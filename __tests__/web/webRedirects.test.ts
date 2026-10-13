/**
 * web 版の本番の配信（Cloudflare Pages）の `_redirects` が、手元の配信・デスクトップ版の配信と
 * 同じ書き換えをすることを縛る。
 *
 * 書き換えの規則の出どころは `src/lib/routeShell.ts` だけ。手元とデスクトップ版は
 * `toRouteShellPath` を、本番は `routeShellRewriteRules` から書き出した `_redirects`
 * （`scripts/web/webRedirects.mjs`）を使う。ここでは書き出した `_redirects` を Cloudflare Pages の
 * 読み方で読み、代表的な URL を通して `toRouteShellPath` と同じ結果になることを確かめる。
 *
 * Cloudflare Pages の読み方（cloudflare/workers-sdk の rules-engine に倣う）:
 * - 1行に `<source> <destination> <status>`。上から順に見て、最初に当たったものを使う
 * - `*` は何でも（空も含む）で、差し替え先の `:splat` に入る。`:name` は `/` を含まない1文字以上
 * - 静的なファイルがあっても規則が先に効く（だから Next の `__next.` のファイルも規則で守る）
 */
import * as crypto from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  ROUTE_PARAM_NAMES,
  routeShellRewriteRules,
  toRouteShellPath,
} from "@/lib/routeShell"

import {
  REDIRECTS_LIMITS,
  renderRedirectsFile,
} from "../../scripts/web/webRedirects.mjs"

interface ParsedRedirect {
  pattern: RegExp
  destination: string
  status: string
}

const escapeRegExp = (text: string) =>
  text.replace(/[.+?^${}()|[\]\\]/g, "\\$&")

/** `_redirects` の1行の source を、Cloudflare Pages と同じ正規表現にする */
const toSourcePattern = (source: string) =>
  new RegExp(
    `^${source
      .split("*")
      .map(escapeRegExp)
      .join("(?<splat>.*)")
      .replace(
        /:([A-Za-z]\w*)/g,
        (_, placeholderName: string) => `(?<${placeholderName}>[^/]+)`
      )}$`
  )

const parseRedirectsFile = (redirectsText: string): ParsedRedirect[] =>
  redirectsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [source, destination, status] = line.split(/\s+/)
      return { pattern: toSourcePattern(source), destination, status }
    })

/** Cloudflare Pages が要求のパスを書き換えた先。どの規則にも当たらなければそのまま */
const rewriteByRedirects = (redirects: ParsedRedirect[], pathname: string) => {
  for (const redirect of redirects) {
    const matched = redirect.pattern.exec(pathname)
    if (!matched) continue
    const groups = matched.groups ?? {}
    return Object.entries(groups).reduce(
      (destination, [groupName, groupValue]) =>
        destination.replaceAll(`:${groupName}`, groupValue),
      redirect.destination
    )
  }
  return pathname
}

const redirectsText = renderRedirectsFile(routeShellRewriteRules())
const redirects = parseRedirectsFile(redirectsText)

const sections = Object.keys(ROUTE_PARAM_NAMES)

/** 代表的な URL のパス（段ごと） */
const samplePathsOf = (section: string) => {
  const id = crypto.randomUUID()
  return [
    `/${section}`,
    `/${section}/`,
    `/${section}/${id}`,
    `/${section}/${id}/`,
    `/${section}/${id}/01-step`,
    `/${section}/${id}/07-score-at-once/`,
    `/${section}/${id}/02-template/__next._tree.txt`,
    `/${section}/${id}/__next._full.txt`,
    `/${section}/${id}.txt`,
    `/${section}/__`,
    `/${section}/__/01-step`,
    `/${section}/__next._tree.txt`,
    `/${section}/__next.!KGFwcCk.${section}.__PAGE__.txt`,
    `/${section}.html`,
    `/${section}.txt`,
  ]
}

/** 動的ルートの外のパス */
const outsidePaths = [
  "/",
  "/index.html",
  "/404.html",
  "/dashboard",
  "/dashboard/settings",
  "/_next/static/chunks/main.js",
  "/__web/page.js",
  "/__web/worker/worker.js",
  "/__web/build.json",
  "/serviceWorker.js",
  "/__appimg/exams/a/b.png",
  "/__next._tree.txt",
]

describe("_redirects（Cloudflare Pages）", () => {
  it.each(sections)(
    "%s: 書き換えの結果が toRouteShellPath と同じ",
    (section) => {
      samplePathsOf(section).forEach((pathname) => {
        expect(
          { pathname, rewritten: rewriteByRedirects(redirects, pathname) },
          pathname
        ).toEqual({ pathname, rewritten: toRouteShellPath(pathname) })
      })
    }
  )

  it("動的ルートの外のパスは書き換えない（toRouteShellPath と同じ）", () => {
    outsidePaths.forEach((pathname) => {
      expect(rewriteByRedirects(redirects, pathname), pathname).toBe(
        toRouteShellPath(pathname)
      )
      expect(rewriteByRedirects(redirects, pathname), pathname).toBe(pathname)
    })
  })

  it("実際の id の URL は殻へ書き換わる（検査の空回りを防ぐ）", () => {
    const id = crypto.randomUUID()
    expect(rewriteByRedirects(redirects, `/exams/${id}/07-score-at-once`)).toBe(
      "/exams/__/07-score-at-once"
    )
  })

  it("どの規則も中身の差し替え（200）で、Cloudflare Pages の上限に収まる", () => {
    expect(redirects.length).toBeGreaterThan(0)
    redirects.forEach((redirect) => expect(redirect.status).toBe("200"))
    expect(redirects.length).toBeLessThanOrEqual(REDIRECTS_LIMITS.dynamicRules)
    redirectsText
      .split("\n")
      .forEach((line) =>
        expect(line.length).toBeLessThanOrEqual(REDIRECTS_LIMITS.lineLength)
      )
  })

  it("* を2つ持つ規則は書き出さない（Cloudflare Pages は1つまで）", () => {
    expect(() =>
      renderRedirectsFile([{ source: "/a/*/b/*", destination: "/c/:splat" }])
    ).toThrow()
  })
})
