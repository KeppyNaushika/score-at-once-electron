/**
 * 規約テスト: 動的ルートは殻1枚＋書き換えで配る（`src/lib/routeShell.ts`）
 *
 * `src/app` に動的セグメントを足したら、2か所をそろえる。どちらかが欠けると、その画面は
 * 実際の id の URL で 404 になるか、id を読めずに空で描かれる。
 *
 * 1. `src/lib/routeShell.ts` の `ROUTE_PARAM_NAMES` に、その段と param 名がある
 *    （配る側の書き換え `toRouteShellPath`・開発用サーバーの `rewrites`・`useRouteParams` は
 *    どれもこの表から作られる）
 * 2. その段の `layout.tsx` が殻を作り、殻以外を描かない（`generateStaticParams` と
 *    `dynamicParams = false`）
 */
import * as fs from "fs"
import * as path from "path"
import { describe, expect, it, vi } from "vitest"

import {
  isRouteSection,
  ROUTE_PARAM_NAMES,
  ROUTE_SHELL_PARAM,
  toRouteShellPath,
} from "@/lib/routeShell"

import { routeShellRewrites } from "../../next.config"

const currentPathname = vi.hoisted(() => ({ value: "/" }))
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname.value,
}))

const { useRouteParams } = await import("@/hooks/useRouteParams")

const APP_DIRECTORY = path.resolve(__dirname, "../../src/app/(app)")

/** `src/app/(app)/<section>/[param]/` の一覧 */
const dynamicRoutes = fs
  .readdirSync(APP_DIRECTORY, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((sectionEntry) =>
    fs
      .readdirSync(path.join(APP_DIRECTORY, sectionEntry.name), {
        withFileTypes: true,
      })
      .filter((entry) => entry.isDirectory() && /^\[.+\]$/.test(entry.name))
      .map((paramEntry) => ({
        section: sectionEntry.name,
        param: paramEntry.name.slice(1, -1),
        directory: path.join(APP_DIRECTORY, sectionEntry.name, paramEntry.name),
      }))
  )

describe("動的ルートの殻", () => {
  it("動的ルートが見つかる（見つからなければ検査が空回りしている）", () => {
    expect(dynamicRoutes.length).toBeGreaterThan(0)
  })

  it("ROUTE_PARAM_NAMES が src/app の動的ルートと一致する", () => {
    expect(
      Object.fromEntries(
        dynamicRoutes.map(({ section, param }) => [section, param])
      )
    ).toEqual(ROUTE_PARAM_NAMES)
  })

  it.each(dynamicRoutes)(
    "$section/[$param] の layout が殻を作り、殻以外を描かない",
    ({ directory, param }) => {
      const layoutSource = fs.readFileSync(
        path.join(directory, "layout.tsx"),
        "utf-8"
      )
      expect(layoutSource).toContain(
        `export const generateStaticParams = () => routeShellParams("${param}")`
      )
      expect(layoutSource).toContain("export const dynamicParams = false")
    }
  )

  it.each(dynamicRoutes)(
    "$section の URL を殻へ書き換える（配る側）",
    ({ section }) => {
      expect(toRouteShellPath(`/${section}/an-id`)).toBe(
        `/${section}/${ROUTE_SHELL_PARAM}`
      )
      expect(toRouteShellPath(`/${section}/an-id/01-step`)).toBe(
        `/${section}/${ROUTE_SHELL_PARAM}/01-step`
      )
    }
  )

  it.each(dynamicRoutes)(
    "$section の URL を殻へ書き換える（開発用サーバー）",
    async ({ section }) => {
      const { beforeFiles } = await routeShellRewrites()
      expect(beforeFiles).toContainEqual({
        source: `/${section}/:id`,
        destination: `/${section}/${ROUTE_SHELL_PARAM}`,
      })
      expect(beforeFiles).toContainEqual({
        source: `/${section}/:id/:path*`,
        destination: `/${section}/${ROUTE_SHELL_PARAM}/:path*`,
      })
    }
  )

  it.each(dynamicRoutes)(
    "$section/[$param] の URL から param を読める",
    ({ section, param }) => {
      currentPathname.value = `/${section}/an-id/01-step`
      expect(useRouteParams()).toEqual({ [param]: "an-id" })
    }
  )
  it("動的ルートの外のパスは書き換えない", () => {
    expect(isRouteSection("login")).toBe(false)
    expect(toRouteShellPath("/")).toBe("/")
    expect(toRouteShellPath("/exams")).toBe("/exams")
    expect(toRouteShellPath("/exams/")).toBe("/exams/")
    expect(toRouteShellPath("/login/x")).toBe("/login/x")
    expect(toRouteShellPath("/_next/static/chunks/a.js")).toBe(
      "/_next/static/chunks/a.js"
    )
    // 一覧（/exams）の画面移動用のファイルは、id と同じ位置に来る
    expect(toRouteShellPath("/exams/__next._tree.txt")).toBe(
      "/exams/__next._tree.txt"
    )
  })
})
