/**
 * web 版の版（`web/webBuild.ts`）の見分け方の固定。
 *
 * 開いている間に配信の版の知らせ（`/__web/build.json`。`scripts/web/webBuildId.mjs` が書く）を
 * 読み、自分と違う版のときだけ再読み込みを勧める。読めない中身では勧めない
 * （配信の不調で、作業中の利用者に再読み込みを促さない）。
 */
import { describe, expect, it } from "vitest"

import {
  createWebBuildId,
  renderBuildInfoFile,
} from "../../scripts/web/webBuildId.mjs"
import { newerBuildIdOf } from "../../web/webBuild"

describe("web 版の版", () => {
  it("書き出した版の知らせを読み、自分と違えばその版を返す", () => {
    const buildInfo: unknown = JSON.parse(renderBuildInfoFile("1.0.0+new"))
    expect(newerBuildIdOf(buildInfo, "1.0.0+old")).toBe("1.0.0+new")
  })

  it("同じ版なら null", () => {
    const buildInfo: unknown = JSON.parse(renderBuildInfoFile("1.0.0+same"))
    expect(newerBuildIdOf(buildInfo, "1.0.0+same")).toBeNull()
  })

  it.each([null, "1.0.0", 1, {}, { buildId: 1 }, { buildId: "" }, []])(
    "読めない中身（%j）なら null",
    (buildInfo) => {
      expect(newerBuildIdOf(buildInfo, "1.0.0+current")).toBeNull()
    }
  )

  it("版は package.json の版から始まり、書き出すたびに変わる", async () => {
    const firstBuildId = await createWebBuildId()
    await new Promise((resolve) => setTimeout(resolve, 5))
    const secondBuildId = await createWebBuildId()
    expect(firstBuildId).toMatch(/^\d+\.\d+\.\d+[^+]*\+[0-9a-z]+$/)
    expect(secondBuildId).not.toBe(firstBuildId)
  })
})
