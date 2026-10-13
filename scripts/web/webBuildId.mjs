/**
 * web 版の版の値（`web/webBuild.ts` の `WEB_BUILD_ID`）を決める。
 *
 * package.json の版（Worker の `__APP_VERSION__` と同じ出どころ）に、書き出した時刻を足す。
 * package.json の版は配るたびには上がらないので、それだけでは配り直しを見分けられない。
 * 中身のハッシュではなく時刻にしたのは、版の値は画面と Worker の束の中に埋め込むので、
 * 束の中身から作ると循環するため。同じ中身を配り直したときにも再読み込みを勧めるが、
 * 害は無い（食い違いを見逃すほうが危ない）。
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

/** 例: `0.18.1-beta+mgp3k2a1`（`+` の後ろは書き出した時刻の36進） */
export const createWebBuildId = async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repoRoot, "package.json"), "utf-8")
  )
  return `${packageJson.version}+${Date.now().toString(36)}`
}

/** 配信に置く版の知らせ（`web/page/webAssetPaths.ts` の `WEB_BUILD_INFO_PATH`）の中身 */
export const renderBuildInfoFile = (buildId) =>
  `${JSON.stringify({ buildId })}\n`
