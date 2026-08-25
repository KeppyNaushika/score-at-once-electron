/**
 * 撮影用の種蒔きを別プロセスで実行する入口
 *
 * 撮影は「空の一覧を撮る → 種を蒔く → 増えた一覧を撮る」と交互に進むので、種蒔きは
 * テストの途中から呼べる必要がある。ところが **Playwright のテストプロセスからは
 * Prisma クライアントを読み込めない**。生成物（`generated/prisma/client.ts`）は
 * `import.meta` を使う ESM の TypeScript で、Playwright は TS を CJS へ落として読むため
 * `SyntaxError: Cannot use 'import.meta' outside a module` になる。
 *
 * そこで種蒔きは tsx の子プロセスで走らせ、テストプロセスからは
 * `helpers/seedClient.ts` の `runSeedCommand()` で呼ぶ。引数と結果は JSON ファイルで
 * やり取りする（標準出力は種蒔きのログに使うので、そこに結果を混ぜない）。
 *
 * 使い方（呼ぶのは `runSeedCommand()` であって、人が直接叩くものではない）:
 *   npx tsx __tests__/screenshots/seedCli.ts <コマンド名> <引数JSON> <結果JSON>
 */

import * as fs from "fs"

import {
  assertSeedLoaded,
  disconnectPrisma,
  regenerateAnswerImages,
  seedClasses,
  seedCoursework,
  seedExamWithScoring,
  seedGradeProject,
  seedSecondGrader,
  seedSimpleExam,
  seedStudents,
  seedSubtotalAndTag,
} from "./helpers/seed-in-test"

/**
 * 子プロセスで呼べる種蒔きの一覧。
 *
 * ここに載せた関数の署名がそのまま `runSeedCommand()` の型になるので、
 * 引数・返り値を呼び出し側へ手で書き写す必要はない。
 */
const SEED_COMMANDS = {
  assertSeedLoaded,
  seedStudents,
  seedClasses,
  seedSubtotalAndTag,
  seedExamWithScoring,
  regenerateAnswerImages,
  seedSecondGrader,
  seedSimpleExam,
  seedCoursework,
  seedGradeProject,
}

export type SeedCommands = typeof SEED_COMMANDS

async function main() {
  const [commandName, argsFilePath, resultFilePath] = process.argv.slice(2)
  const seedCommand = Object.entries(SEED_COMMANDS).find(
    ([name]) => name === commandName
  )?.[1]
  if (!seedCommand) {
    throw new Error(`知らない種蒔きコマンドです: ${commandName}`)
  }

  // 引数の型は呼び出し側（runSeedCommand）が SeedCommands から取って保証している。
  // ここは JSON で運ばれてきた配列をそのまま渡し直すだけなので Reflect.apply で呼ぶ
  const args: unknown[] = JSON.parse(fs.readFileSync(argsFilePath, "utf-8"))
  const result: unknown = await Reflect.apply(seedCommand, undefined, args)

  fs.writeFileSync(resultFilePath, JSON.stringify(result ?? null))
  await disconnectPrisma()
}

main().catch((error) => {
  console.error(error)
  disconnectPrisma().finally(() => process.exit(1))
})
