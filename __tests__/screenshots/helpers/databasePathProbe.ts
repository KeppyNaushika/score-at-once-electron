/**
 * 「アプリが実際に開く DB はどれか」をメインプロセスに訊くための小さな橋
 *
 * 答えを持っているのは `electron-src/lib/prisma/databaseInitializer.ts` の
 * `getDatabasePath()` だが、これは TypeScript なのでメインプロセスから直接は読めない。
 * `main/electron-src/` に転がっている古い `tsc` の出力を読む手もあるが、いまビルドを
 * 作っているのは esbuild（`scripts/buildMain.js`）で、そちらは全部を1つの
 * `index.js` へ束ねる。つまり `main/electron-src/lib/...` は**誰も作り直していない
 * 置き土産**で、それを読むと古い判定を信じることになる。
 *
 * そこで撮影のたびに、同じソースから小さな束を作り直してメインプロセスに読ませる。
 * 束ねるのは `getDatabasePath()` に要る分だけで、Prisma のクライアントとアダプタは
 * （この関数が触らないので）空の実装に差し替える。
 */

import * as esbuild from "esbuild"
import * as path from "path"

const PROJECT_ROOT = path.resolve(__dirname, "../../..")

/** 作った束の置き場（git の管理外） */
export const DATABASE_PATH_PROBE = path.join(
  PROJECT_ROOT,
  "node_modules/.cache/score-at-once-screenshots/databasePathProbe.js"
)

/**
 * `getDatabasePath` だけを CommonJS の1ファイルへ束ねる
 *
 * メインプロセスからは `require(DATABASE_PATH_PROBE).getDatabasePath()` で呼ぶ。
 */
export async function buildDatabasePathProbe(): Promise<void> {
  // プラグインを使うので同期版（buildSync）は使えない
  await esbuild.build({
    stdin: {
      contents: `export { getDatabasePath } from ${JSON.stringify(
        path.join(PROJECT_ROOT, "electron-src/lib/prisma/databaseInitializer")
      )}`,
      resolveDir: PROJECT_ROOT,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    target: "es2022",
    format: "cjs",
    packages: "external",
    outfile: DATABASE_PATH_PROBE,
    plugins: [
      {
        // Prisma のクライアントは生成物（ESM の TypeScript）なので素直には読めない。
        // `getDatabasePath()` は触らないので、名前だけある空の実装に差し替える
        name: "stub-unused-prisma",
        setup(build) {
          build.onResolve(
            { filter: /^@prisma\/(client|adapter-better-sqlite3)$/ },
            (args) => ({ path: args.path, namespace: "stub-unused-prisma" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "stub-unused-prisma" },
            () => ({
              contents:
                "export class PrismaClient {}\nexport class PrismaBetterSqlite3 {}",
              loader: "ts",
            })
          )
        },
      },
    ],
  })
}
