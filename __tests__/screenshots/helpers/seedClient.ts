/**
 * テストプロセスから種蒔きを呼ぶ窓口
 *
 * 中身は tsx の子プロセスで走る（理由は `../seedCli.ts` の冒頭）。ここは引数と結果を
 * JSON ファイルへ置いて子を呼ぶだけで、**署名は `SeedCommands` から取る**ので
 * 種蒔き側の引数・返り値を手で書き写すことはない。
 */

import { execFileSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type { SeedCommands } from "../seedCli"

const PROJECT_ROOT = path.resolve(__dirname, "../../..")
const TSX_BIN = path.join(PROJECT_ROOT, "node_modules/.bin/tsx")
const SEED_CLI = path.resolve(__dirname, "../seedCli.ts")

type SeedCommandName = keyof SeedCommands

type SeedCommandArgs<Name extends SeedCommandName> =
  SeedCommands[Name] extends (...args: infer Args) => unknown ? Args : never

type SeedCommandResult<Name extends SeedCommandName> =
  SeedCommands[Name] extends (...args: never[]) => Promise<infer Result>
    ? Result
    : never

/**
 * 種蒔きを1つ、tsx の子プロセスで実行する
 *
 * @param commandName - `seedCli.ts` の `SEED_COMMANDS` に載っている名前
 * @param args - その関数の引数（型は署名から決まる）
 * @returns その関数の返り値（JSON を通るので Date やクラスは渡せない）
 * @throws 子プロセスが失敗した場合
 */
export function runSeedCommand<Name extends SeedCommandName>(
  commandName: Name,
  args: SeedCommandArgs<Name>
): SeedCommandResult<Name> {
  const exchangeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "score-at-once-seed-")
  )
  const argsFilePath = path.join(exchangeDir, "args.json")
  const resultFilePath = path.join(exchangeDir, "result.json")
  fs.writeFileSync(argsFilePath, JSON.stringify(args))

  try {
    execFileSync(
      TSX_BIN,
      [SEED_CLI, commandName, argsFilePath, resultFilePath],
      { cwd: PROJECT_ROOT, stdio: "inherit" }
    )
    return JSON.parse(fs.readFileSync(resultFilePath, "utf-8"))
  } finally {
    fs.rmSync(exchangeDir, { recursive: true, force: true })
  }
}
