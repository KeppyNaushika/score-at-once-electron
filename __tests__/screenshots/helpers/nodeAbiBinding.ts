/**
 * 撮影 e2e 用に「素の Node 向け better-sqlite3」を1つ確保しておく仕掛け
 *
 * 撮影は1回の実行で2つのランタイムが同じネイティブモジュールを使う。
 *
 * | 誰が                        | 何のために                 | ABI          |
 * | --------------------------- | -------------------------- | ------------ |
 * | Playwright のテストプロセス | `seed-in-test.ts` の種蒔き | 素の Node    |
 * | Electron のメインプロセス   | アプリ本体が DB を開く     | Electron     |
 *
 * ところが `better_sqlite3.node` は `node_modules/better-sqlite3/build/Release/` に
 * **1つしか無い**。NODE_MODULE_VERSION は Node と Electron で違う
 * （2026-08 実測: Node 24 が 137、Electron 43 が 148）ので、
 * `scripts/ensure-sqlite-abi.js` でどちらか一方へそろえると**もう一方は必ず落ちる**。
 *
 * 素の Node 向けのままにしておくと、落ちるのは Electron 側 ——
 * つまり**アプリが DB を1つも開けないまま撮影が回る**。種は入るのに画面は空、という
 * 状態で最後まで走り切るので、緑で終わったのに使える画像が1枚も無い、という形で現れる。
 *
 * そこで素の Node 向けのバイナリを1つ退避しておき、node_modules 側は Electron 向けへ
 * そろえる。テストプロセスの Prisma だけが退避コピーを名指しして読む
 * （better-sqlite3 の `Options.nativeBinding` を `@prisma/adapter-better-sqlite3` が
 * `new Database(path, config)` へ素通しする）。
 */

import { execFileSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

const PROJECT_ROOT = path.resolve(__dirname, "../../..")

/** node_modules に置かれている、いま有効なバイナリ */
const INSTALLED_BINDING = path.join(
  PROJECT_ROOT,
  "node_modules/better-sqlite3/build/Release/better_sqlite3.node"
)

/**
 * 素の Node 向けバイナリの退避先。
 *
 * `node_modules/.cache/` に置く。git の管理外であり、撮影用の `artifacts/` と違って
 * Playwright が実行のたびに空にすることもない。
 */
export const NODE_ABI_BINDING_PATH = path.join(
  PROJECT_ROOT,
  "node_modules/.cache/score-at-once-screenshots/better_sqlite3-node.node"
)

/**
 * 退避コピーが「この Node で実際に開けるか」を子プロセスで確かめる
 *
 * ファイルの有無では足りない。better-sqlite3 のバージョンが上がった後の古い退避や、
 * Electron 向けを誤って写した退避は、存在はしていても開けない。
 * 判定を子プロセスでやるのは、一度開くとプロセス内にキャッシュされて差し替えが
 * 効かなくなるため（`scripts/ensure-sqlite-abi.js` と同じ理由）。
 */
function isNodeAbiBindingUsable(): boolean {
  if (!fs.existsSync(NODE_ABI_BINDING_PATH)) return false
  const probe =
    "const D=require('better-sqlite3');" +
    `new D(':memory:',{nativeBinding:${JSON.stringify(NODE_ABI_BINDING_PATH)}}).close()`
  try {
    execFileSync(process.execPath, ["-e", probe], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}

/** いま node_modules にあるバイナリを退避先へ写す */
function stashNodeAbiBinding(): void {
  fs.mkdirSync(path.dirname(NODE_ABI_BINDING_PATH), { recursive: true })
  fs.copyFileSync(INSTALLED_BINDING, NODE_ABI_BINDING_PATH)
}

/**
 * 素の Node 向けバイナリの退避コピーを用意する
 *
 * 使えるコピーが既にあれば何もしない（作り直しは1分ほど掛かる）。無ければ
 * `ensure-sqlite-abi.js node` で node_modules 側を素の Node 向けにしてから写す。
 * このあと node_modules 側を Electron 向けへ戻すのは呼び出し側（`globalSetup.ts`）。
 *
 * @throws 作り直しても開けるコピーにならなかった場合
 */
export function ensureNodeAbiBinding(): void {
  if (isNodeAbiBindingUsable()) return

  execFileSync(
    process.execPath,
    [path.join(PROJECT_ROOT, "scripts/ensure-sqlite-abi.js"), "node"],
    { cwd: PROJECT_ROOT, stdio: "inherit" }
  )
  stashNodeAbiBinding()

  if (!isNodeAbiBindingUsable()) {
    throw new Error(
      `素の Node 向け better-sqlite3 を用意できませんでした: ${NODE_ABI_BINDING_PATH}`
    )
  }
}

/**
 * 退避コピーのパスを返す
 *
 * @throws 退避コピーが用意されていない場合（globalSetup を通さず spec だけ走らせたとき）
 */
export function requireNodeAbiBinding(): string {
  if (!fs.existsSync(NODE_ABI_BINDING_PATH)) {
    throw new Error(
      `素の Node 向け better-sqlite3 の退避コピーがありません: ${NODE_ABI_BINDING_PATH}\n` +
        `npm run screenshot から実行してください（globalSetup が用意します）。`
    )
  }
  return NODE_ABI_BINDING_PATH
}
