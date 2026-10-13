/**
 * デスクトップ版で、画面が新しい窓で開こうとした URL のうち、既定のブラウザへ渡すのは
 * package.json に書いたソースの在りか（とその中のページ）だけ、を縛る
 * （`electron-src/windowManager.ts` の `restrictNavigation`）。
 */
import * as path from "node:path"

import { describe, expect, it, vi } from "vitest"

import { isSourceRepositoryUrl } from "@/electron-src/lib/sourceRepository"

vi.mock("electron", () => ({
  app: { getAppPath: () => path.resolve(__dirname, "../..") },
}))

const SOURCE_REPOSITORY_URL =
  "https://github.com/KeppyNaushika/score-at-once-electron"

describe("isSourceRepositoryUrl", () => {
  it("ソースの在りかと、その中のページ（LICENSE など）は通す", async () => {
    expect(await isSourceRepositoryUrl(SOURCE_REPOSITORY_URL)).toBe(true)
    expect(
      await isSourceRepositoryUrl(`${SOURCE_REPOSITORY_URL}/blob/main/LICENSE`)
    ).toBe(true)
  })

  it("同じ接頭辞の別のリポジトリや、ほかのサイトは通さない", async () => {
    expect(await isSourceRepositoryUrl(`${SOURCE_REPOSITORY_URL}-fork`)).toBe(
      false
    )
    expect(await isSourceRepositoryUrl("https://example.com/")).toBe(false)
    expect(await isSourceRepositoryUrl("file:///etc/passwd")).toBe(false)
  })
})
