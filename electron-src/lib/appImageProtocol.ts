/**
 * デスクトップ版の `appimg://` の要求 URL を、読むファイルの絶対パスに直す規則。
 *
 * renderer は `src/lib/appImageUrl.ts` の規則で、共有するファイルの根からの相対パスを
 * `appimg:///<相対パス>` にして読む。ここはその逆で、根の下に解決できないもの
 * （`..` で出るもの・絶対パス・エンコードした区切りを戻すと外へ出るもの・根そのもの）は
 * null を返し、ハンドラは何も読まずに断る（`electron-src/index.ts`）。
 */

import { resolveUnderRoot } from "./pathContainment"

/** v0.6.x で `projects/` を `exams/` へ改名した。古い URL もそのまま読めるようにする */
const LEGACY_PROJECTS_PREFIX = "projects/"

/**
 * `appimg://` の要求 URL から、共有するファイルの根の下の絶対パスを返す。
 * 根の下に解決できない・URL のエンコードが壊れているなら null
 */
export function resolveAppImageRequestPath(
  requestUrl: string,
  sharedFilesDirectory: string
): string | null {
  // new URL() を使わず文字列操作でパスを抽出する
  // （appimg://exams/... と appimg:///exams/... の両方を受け付ける）
  let relativePath: string
  try {
    relativePath = decodeURIComponent(requestUrl.replace(/^appimg:\/\/\/?/, ""))
  } catch {
    return null
  }

  if (relativePath.startsWith(LEGACY_PROJECTS_PREFIX)) {
    relativePath = `exams/${relativePath.slice(LEGACY_PROJECTS_PREFIX.length)}`
  }

  const resolved = resolveUnderRoot(sharedFilesDirectory, relativePath)
  return resolved.kind === "ok" ? resolved.absolutePath : null
}
