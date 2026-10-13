/**
 * 「一括採点について」に出す、同梱するライブラリのライセンスの一覧を縛る。
 *
 * 一覧は手で持たず、ビルドのたびに `package-lock.json` と `node_modules` から作る
 * （`scripts/thirdPartyLicenses.mjs`）。依存を足したのに一覧に出ない・開発にしか使わない
 * ものが混ざる・手元のパスが web 版の配信に乗る、を防ぐ。
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { describe, expect, it } from "vitest"

import { buildThirdPartyLicenseList } from "../../scripts/thirdPartyLicenses.mjs"

const rootDir = path.resolve(__dirname, "../..")
const packageJson: {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
} = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"))
const list = buildThirdPartyLicenseList(rootDir)
const packageNames = new Set(
  list.packages.map((thirdPartyPackage) => thirdPartyPackage.name)
)

describe("同梱するライブラリのライセンスの一覧", () => {
  it("package.json の dependencies は全部載る", () => {
    const missing = Object.keys(packageJson.dependencies).filter(
      (packageName) => !packageNames.has(packageName)
    )

    expect(missing).toEqual([])
  })

  it("開発にしか使わないもの（vitest など）は載らない", () => {
    expect(packageNames.has("vitest")).toBe(false)
    expect(packageNames.has("eslint")).toBe(false)
  })

  it("Electron はデスクトップ版の配布物にだけ入るものとして載る", () => {
    const electron = list.packages.find(
      (thirdPartyPackage) => thirdPartyPackage.name === "electron"
    )

    expect(electron?.desktopOnly).toBe(true)
  })

  it("サブフォルダにある同梱物のライセンス（pdf.js の wasm など）も本文に入る", () => {
    const pdfjs = list.packages.find(
      (thirdPartyPackage) => thirdPartyPackage.name === "pdfjs-dist"
    )
    const licenseText =
      pdfjs?.licenseTextId != null ? list.licenseTexts[pdfjs.licenseTextId] : ""

    expect(licenseText).toContain("--- wasm/LICENSE_OPENJPEG ---")
  })

  it("手元のパスを含まない（web 版の配信に乗る）", () => {
    expect(JSON.stringify(list)).not.toContain(rootDir)
  })
})
