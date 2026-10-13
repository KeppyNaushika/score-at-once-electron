import { app } from "electron"
import * as fsPromises from "fs/promises"
import * as path from "path"

/**
 * ソースの在りか（package.json の `repository.url`）。「一括採点について」の画面が出す
 * リンクと同じ出どころ（画面は `next.config.ts` の `env` で受ける）。読めなければ null。
 *
 * package.json は開発時はリポジトリの根に、パッケージ版は app.asar の根にある
 * （どちらも `app.getAppPath()`）
 */
async function readSourceRepositoryUrl(): Promise<string | null> {
  try {
    const packageJson: unknown = JSON.parse(
      await fsPromises.readFile(
        path.join(app.getAppPath(), "package.json"),
        "utf8"
      )
    )
    if (
      typeof packageJson === "object" &&
      packageJson !== null &&
      "repository" in packageJson &&
      typeof packageJson.repository === "object" &&
      packageJson.repository !== null &&
      "url" in packageJson.repository &&
      typeof packageJson.repository.url === "string"
    ) {
      return packageJson.repository.url
    }
  } catch {
    // 読めないなら、ソースのリンクも開かない
  }
  return null
}

/**
 * 画面が新しい窓で開こうとした URL が、ソースの在りか（とその中のページ）か。
 * 前方一致は `/` の区切りまで見る（同じ接頭辞の別のリポジトリを通さない）
 */
export async function isSourceRepositoryUrl(url: string): Promise<boolean> {
  const sourceRepositoryUrl = await readSourceRepositoryUrl()
  if (sourceRepositoryUrl === null) return false
  return (
    url === sourceRepositoryUrl || url.startsWith(`${sourceRepositoryUrl}/`)
  )
}
