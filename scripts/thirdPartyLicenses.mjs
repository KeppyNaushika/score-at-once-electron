/**
 * 配布物に同梱するライブラリのライセンスの一覧を作る（「一括採点について」の画面が読む）。
 *
 * 一覧は手で持たない。`package-lock.json` から本番の依存（`dev` でないもの）を全部拾い、
 * ライセンスの種類は lockfile の `license` から、本文は `node_modules` の各パッケージの
 * LICENSE・COPYING・NOTICE から取る。依存を足し引きすれば、次のビルドで一覧も変わる。
 *
 * - 他の OS 向けの任意の依存（sharp の `@img/*` など）は手元に入っていないことがある。
 *   lockfile には載っているので一覧には出し、本文が読めないときは本文無しで出す
 * - devDependencies のうち、配布物そのものになるもの（`DISTRIBUTED_DEV_PACKAGES`）だけは足す。
 *   画面・main・Worker のコードが devDependencies を import していないことは、規約テスト
 *   `bundledImportsAreDependencies` が縛る
 * - 手元のパスは書き出さない（web 版の書き出しの点検 `checkWebDist.mjs` が止める）
 *
 * 使い方: `node scripts/thirdPartyLicenses.mjs`（`public/third-party-licenses.json` へ書く。
 * `npm run build`・`predev`・web 版の配信のワークフローが呼ぶ）
 */

import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * devDependencies だが配布物に入るもの。Electron はデスクトップ版の実行環境そのもの
 * （Chromium のライセンスは、Electron が配布物に同梱する `LICENSES.chromium.html` にある）
 */
export const DISTRIBUTED_DEV_PACKAGES = { electron: { desktopOnly: true } }

/**
 * ライセンスの本文を置くファイルの名前（LICENSE・LICENSE.md・LICENCE-MIT・COPYING・NOTICE・
 * THIRD-PARTY-NOTICES.md など）。wasm-vips は同梱する libvips などの表示を
 * THIRD-PARTY-NOTICES.md に置く
 */
const LICENSE_FILE_PATTERN =
  /^(licen[cs]e|copying|notice|third[-_]party[-_]notices)([-._].*)?$/i

export const THIRD_PARTY_LICENSES_FILE = "third-party-licenses.json"

/** lockfile の場所（`node_modules/a/node_modules/@b/c`）からパッケージ名（`@b/c`）を取る */
const packageNameOfLockPath = (lockPath) =>
  lockPath.slice(lockPath.lastIndexOf("node_modules/") + "node_modules/".length)

/**
 * パッケージのフォルダにあるライセンスのファイル（根からの相対パス）。サブフォルダも探す
 * （pdf.js は同梱する wasm・フォントのライセンスを `wasm/`・`standard_fonts/` に置く）。
 * 入れ子の `node_modules` は別のパッケージなので入らない
 */
function findLicenseFiles(packageDir, relativeDir = "") {
  const entries = readdirSync(path.join(packageDir, relativeDir), {
    withFileTypes: true,
  })
  const ownFiles = entries
    .filter((entry) => entry.isFile() && LICENSE_FILE_PATTERN.test(entry.name))
    .map((entry) => path.posix.join(relativeDir, entry.name))
    .sort()
  const nestedFiles = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) =>
      findLicenseFiles(packageDir, path.posix.join(relativeDir, entry.name))
    )
  return [...ownFiles, ...nestedFiles]
}

/**
 * パッケージのライセンスの本文。複数あればつなぎ、サブフォルダのものには在りかを添える。
 * 無ければ null
 */
function readLicenseText(packageDir) {
  if (!existsSync(packageDir)) return null
  const licenseFiles = findLicenseFiles(packageDir)
  if (licenseFiles.length === 0) return null
  return licenseFiles
    .map((licenseFile) => {
      const text = readFileSync(
        path.join(packageDir, licenseFile),
        "utf8"
      ).trim()
      return licenseFile.includes("/")
        ? `--- ${licenseFile} ---\n${text}`
        : text
    })
    .join("\n\n")
}

/**
 * 同梱するライブラリの一覧。同じ本文は1つにまとめ（MIT の雛形が何百も並ぶため）、
 * 各パッケージは本文の id を指す。
 *
 * @param {string} rootDir リポジトリの根
 */
export function buildThirdPartyLicenseList(rootDir) {
  const lockfile = JSON.parse(
    readFileSync(path.join(rootDir, "package-lock.json"), "utf8")
  )
  /** @type {Record<string, string>} */
  const licenseTexts = {}
  const packages = Object.entries(lockfile.packages)
    .filter(([lockPath, lockEntry]) => {
      if (lockPath === "" || lockEntry.link) return false
      const packageName = packageNameOfLockPath(lockPath)
      return !lockEntry.dev || packageName in DISTRIBUTED_DEV_PACKAGES
    })
    .map(([lockPath, lockEntry]) => {
      const packageName = packageNameOfLockPath(lockPath)
      const licenseText = readLicenseText(path.join(rootDir, lockPath))
      const licenseTextId =
        licenseText === null
          ? null
          : createHash("sha256").update(licenseText).digest("hex").slice(0, 16)
      if (licenseTextId !== null) licenseTexts[licenseTextId] = licenseText
      return {
        name: packageName,
        version: lockEntry.version ?? "",
        license: lockEntry.license ?? null,
        licenseTextId,
        desktopOnly:
          DISTRIBUTED_DEV_PACKAGES[packageName]?.desktopOnly === true,
      }
    })
    // 同じ名前・同じ版が入れ子で何度も入っていることがある
    .filter(
      (thirdPartyPackage, index, all) =>
        all.findIndex(
          (other) =>
            other.name === thirdPartyPackage.name &&
            other.version === thirdPartyPackage.version
        ) === index
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.version.localeCompare(right.version)
    )
  return { packages, licenseTexts }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  )
  const list = buildThirdPartyLicenseList(rootDir)
  writeFileSync(
    path.join(rootDir, "public", THIRD_PARTY_LICENSES_FILE),
    JSON.stringify(list)
  )
  console.log(
    `[third-party-licenses] ${list.packages.length} 件（本文 ${Object.keys(list.licenseTexts).length} 種）`
  )
}
