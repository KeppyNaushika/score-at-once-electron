/**
 * 評価スクリプトの引数の読み取りと、データの置き場所の守り。
 *
 * データの場所（写しの DB・画像のフォルダ・出力先）は必ず引数で受け、既定値を持たない。
 * リポジトリの中（本番の `data/` を含む）を指したら止める。評価に使ってよいのは
 * リポジトリの外に置いた開発用の写しだけで、結果もリポジトリの外へ出す。
 */

import * as fs from "fs"
import * as path from "path"

const REPOSITORY_ROOT = path.resolve(__dirname, "../..")

/** `--name value` の形の引数を読む */
export function readArgs(argv: readonly string[]): Map<string, string> {
  const args = new Map<string, string>()
  argv.forEach((token, tokenIndex) => {
    if (!token.startsWith("--")) return
    const next = argv[tokenIndex + 1]
    args.set(
      token.slice(2),
      next === undefined || next.startsWith("--") ? "true" : next
    )
  })
  return args
}

export function requireArg(args: Map<string, string>, name: string): string {
  const argValue = args.get(name)
  if (argValue === undefined || argValue === "true") {
    throw new Error(`--${name} を指定してください`)
  }
  return argValue
}

/** 整数の引数（無ければ既定値） */
export function readIntegerArg(
  args: Map<string, string>,
  name: string,
  fallback: number
): number {
  const argValue = args.get(name)
  if (argValue === undefined) return fallback
  const parsed = Number.parseInt(argValue, 10)
  if (!Number.isFinite(parsed))
    throw new Error(`--${name} は整数です: ${argValue}`)
  return parsed
}

/** リポジトリの外のパスであることを確かめて、絶対パスにする */
export function resolveOutsideRepository(
  targetPath: string,
  purpose: string
): string {
  const resolved = fs.existsSync(targetPath)
    ? fs.realpathSync(targetPath)
    : path.resolve(targetPath)
  const repositoryRoot = fs.realpathSync(REPOSITORY_ROOT)
  const relative = path.relative(repositoryRoot, resolved)
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error(
      `${purpose}がリポジトリの中を指しています: ${resolved}（開発用の写しと scratchpad だけを使う）`
    )
  }
  return resolved
}

/** カンマ区切りの一覧（無ければ null） */
export function readListArg(
  args: Map<string, string>,
  name: string
): string[] | null {
  const argValue = args.get(name)
  if (argValue === undefined) return null
  return argValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
}

/** 同時に走らせる数を絞りながら、全件を処理する */
export async function runWithConcurrency<Input>(
  inputs: readonly Input[],
  concurrency: number,
  worker: (input: Input, inputIndex: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0
  const lanes = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (nextIndex < inputs.length) {
      const inputIndex = nextIndex
      nextIndex += 1
      await worker(inputs[inputIndex], inputIndex)
    }
  })
  await Promise.all(lanes)
}
