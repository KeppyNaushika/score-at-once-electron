/**
 * 配る前に、web 版の書き出し（`web-dist/`）に入ってはいけないものが無いかを確かめる。
 * 見つかったら一覧を出して失敗する（デプロイのワークフローが、デプロイの前に走らせる）。
 *
 * - ファイル: ソースマップ（`.map`）・DB（`.db`・`.sqlite`）・`.env`・鍵（`.pem`・`.key`）
 * - 中身（文字のファイルだけ）: 手元や CI の絶対パス・API キーや鍵の形をした文字列・
 *   `.env` の値（リポジトリの直下に `.env` があるときだけ。8文字未満の値は見ない）
 *
 * wasm・画像・フォントなどのバイナリは中身を見ない（依存が自分の手元で作ったときのパスを
 * 含むことがあり、こちらの情報ではない）。
 *
 * 使い方: node scripts/web/checkWebDist.mjs [web-dist のパス]
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

/** 入っていてはいけないファイルの名前 */
const FORBIDDEN_FILE_PATTERNS = [
  { pattern: /\.map$/i, reason: "ソースマップ" },
  { pattern: /\.(db|sqlite|sqlite3)(-journal|-wal|-shm)?$/i, reason: "DB" },
  { pattern: /(^|\/)\.env(\..*)?$/i, reason: ".env" },
  { pattern: /\.(pem|key|p12|pfx)$/i, reason: "鍵" },
]

/** 中身を見るファイル（拡張子の無い `_headers`・`_redirects` も見る） */
const TEXT_FILE_PATTERN =
  /(\.(html|txt|js|mjs|cjs|css|json|svg|xml)|^_[a-z]+)$/i

/** 中身に入っていてはいけない文字列 */
const FORBIDDEN_CONTENT_PATTERNS = [
  { pattern: /\/Users\/[^/\s"'`]+/, reason: "macOS の手元のパス" },
  { pattern: /\/home\/runner\//, reason: "CI の作業場所のパス" },
  { pattern: /[A-Za-z]:\\\\?Users\\\\?/, reason: "Windows の手元のパス" },
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/, reason: "Anthropic の API キー" },
  { pattern: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}/, reason: "OpenAI の API キー" },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}/, reason: "Google の API キー" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, reason: "AWS のアクセスキー" },
  {
    pattern: /\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}\b/,
    reason: "GitHub のトークン",
  },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/, reason: "GitHub のトークン" },
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    reason: "秘密鍵",
  },
  {
    pattern: /discord(app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{20,}/,
    reason: "Discord の Webhook",
  },
]

/** `.env` の値で、これより短いものは照らさない（`true`・`3000` などがどこにでもあるため） */
const ENV_VALUE_MIN_LENGTH = 8

/** `.env` の書式（`NAME=value`・`NAME="value"`）から値を取り出す */
export const envValuesOf = (envText) =>
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.replace(/^export\s+/, ""))
    .filter((line) => line.includes("="))
    .map((line) =>
      line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2")
    )
    .filter((envValue) => envValue.length >= ENV_VALUE_MIN_LENGTH)

/**
 * 書き出しのファイルの一覧から、見つかった問題を返す。
 *
 * @param {{ relativePath: string, text: string | null }[]} distFiles
 *   `relativePath` は `/` 区切り。`text` は文字のファイルの中身（バイナリは null）
 * @param {string[]} envValues 入っていてはいけない `.env` の値
 * @returns {{ relativePath: string, reason: string }[]}
 */
export const findWebDistProblems = (distFiles, envValues = []) =>
  distFiles.flatMap(({ relativePath, text }) => {
    const fileProblems = FORBIDDEN_FILE_PATTERNS.filter(({ pattern }) =>
      pattern.test(relativePath)
    ).map(({ reason }) => ({ relativePath, reason }))
    if (text === null) return fileProblems
    const contentProblems = FORBIDDEN_CONTENT_PATTERNS.flatMap(
      ({ pattern, reason }) => {
        const matched = text.match(pattern)
        return matched
          ? [
              {
                relativePath,
                reason: `${reason}（${matched[0].slice(0, 12)}…）`,
              },
            ]
          : []
      }
    )
    const envProblems = envValues
      .filter((envValue) => text.includes(envValue))
      .map(() => ({ relativePath, reason: ".env の値" }))
    return [...fileProblems, ...contentProblems, ...envProblems]
  })

const readEnvValues = async () => {
  const entries = await readdir(repoRoot, { withFileTypes: true })
  const envFiles = entries.filter(
    (entry) =>
      entry.isFile() &&
      /^\.env(\..+)?$/.test(entry.name) &&
      entry.name !== ".env.example"
  )
  const envTexts = await Promise.all(
    envFiles.map((entry) => readFile(path.join(repoRoot, entry.name), "utf8"))
  )
  return envTexts.flatMap(envValuesOf)
}

const readDistFiles = async (distDir) => {
  const entries = await readdir(distDir, {
    recursive: true,
    withFileTypes: true,
  })
  const files = entries.filter((entry) => entry.isFile())
  return Promise.all(
    files.map(async (entry) => {
      const filePath = path.join(entry.parentPath, entry.name)
      const relativePath = path
        .relative(distDir, filePath)
        .split(path.sep)
        .join("/")
      const text = TEXT_FILE_PATTERN.test(entry.name)
        ? await readFile(filePath, "utf8")
        : null
      return { relativePath, text }
    })
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = path.resolve(
    process.argv[2] ?? path.join(repoRoot, "web-dist")
  )
  const [distFiles, envValues] = await Promise.all([
    readDistFiles(distDir),
    readEnvValues(),
  ])
  if (distFiles.length === 0) {
    console.error(`${distDir} が空です。先に web:build で書き出してください。`)
    process.exit(1)
  }
  const problems = findWebDistProblems(distFiles, envValues)
  if (problems.length > 0) {
    console.error("配ってはいけないものが web-dist に入っています:")
    problems.forEach(({ relativePath, reason }) =>
      console.error(`  ${relativePath}: ${reason}`)
    )
    process.exit(1)
  }
  console.log(
    `web-dist: ${distFiles.length} ファイルを確かめ、問題はありませんでした`
  )
}
