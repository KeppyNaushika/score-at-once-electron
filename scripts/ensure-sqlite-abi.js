/**
 * better-sqlite3 のネイティブバイナリを、実行ランタイムのABIに合わせて
 * 必要なときだけリビルドする冪等スクリプト。
 *
 * 背景:
 *   - Electronアプリ (npm run dev / make) は Electron同梱Node のABIを要求する
 *   - vitestテスト / scripts は素のNode のABIを要求する
 *   この2つはABIが異なるため、単一の .node バイナリでは両立できない。
 *   ターゲットを切り替えるたびに該当ABIへ作り直す必要がある。
 *
 * 落とし穴メモ（このスクリプトが対処していること）:
 *   1. require("better-sqlite3") はネイティブ部を遅延ロードするため、ABI不一致は
 *      require では分からない。実際に new Database() で開いて初めて判明する。
 *   2. 素の `electron-rebuild` は Node用プリビルド(誤ABI)をダウンロードしてしまう。
 *      `--build-from-source` で Electronヘッダからコンパイルさせる必要がある。
 *   3. electron-rebuild / npm rebuild は build/Release に既存バイナリがあると
 *      キャッシュ復元で済ませ上書きしない。リビルド前に削除して強制再生成する。
 *   4. ABIは「Node向けかElectron向けか」の2値ではない。Electronのメジャー更新で
 *      Electron側のABIも変わる（42=146, 43=148）。2値判定のままだと旧メジャー向けの
 *      バイナリを「既にelectron向け」と誤認し、リビルドを省いてアプリ起動時に落ちる。
 *      そのためElectronは要求ABIの一致まで確認する。
 *
 * 使い方:
 *   node scripts/ensure-sqlite-abi.js electron   # Electronアプリ起動前
 *   node scripts/ensure-sqlite-abi.js node       # vitestテスト前
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const target = process.argv[2]
if (target !== "electron" && target !== "node") {
  console.error(
    `[ensure-sqlite-abi] 使い方: node scripts/ensure-sqlite-abi.js <electron|node>`
  )
  process.exit(1)
}

const BUILD_RELEASE = path.resolve(
  __dirname,
  "../node_modules/better-sqlite3/build/Release/better_sqlite3.node"
)

/**
 * 現在インストールされている Electron が要求する NODE_MODULE_VERSION を返す。
 *
 * Electron のメジャー更新で ABI は変わる（42=146, 43=148）。「Electron向けかどうか」
 * だけでなく「どのElectronのABIか」まで見ないと、旧メジャー向けバイナリを
 * 「既にelectron向け」と誤認してアプリ起動時に落ちる。
 * @returns {number|null} 判定できない場合は null（その場合は常にリビルドする）
 */
function expectedElectronAbi() {
  try {
    const electronVersion = require("electron/package.json").version
    return Number(require("node-abi").getAbi(electronVersion, "electron"))
  } catch {
    return null
  }
}

/**
 * 現在 build/Release に置かれているバイナリのターゲットを判定する。
 *
 * 必ず子プロセスで判定する: ネイティブ部は一度 new Database() で開くとプロセス内に
 * キャッシュ＆メモリマップされ、その後ファイルを差し替えても同一プロセスからは
 * 古いバイナリが見え続ける。リビルド前後で同じプロセスから判定すると誤検知するため。
 *
 * require() はネイティブ部を遅延ロードするので、実際に DB を開いて dlopen を強制する。
 * ABI不一致のエラーメッセージ先頭の NODE_MODULE_VERSION がバイナリ側のABIなので、
 * それを取り出して「どのElectron向けか」まで特定する。
 * @returns {{kind:"node"}|{kind:"electron",abi:number}|{kind:"none"}}
 */
function detectCurrentTarget() {
  const probe =
    "try{const D=require('better-sqlite3');new D(':memory:').close();" +
    "process.stdout.write('node')}" +
    "catch(e){process.stdout.write('ERR:'+String(e&&e.message).replace(/\\s+/g,' '))}"
  let out
  try {
    out = execSync(`node -e "${probe}"`, {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return { kind: "none" }
  }
  if (out === "node") return { kind: "node" }
  // 「compiled against ... NODE_MODULE_VERSION <X>. This version of Node.js requires
  //  NODE_MODULE_VERSION <Y>」の最初の数値がバイナリ側のABI。
  const matched = out.match(/NODE_MODULE_VERSION (\d+)/)
  if (matched) return { kind: "electron", abi: Number(matched[1]) }
  return { kind: "none" }
}

const current = detectCurrentTarget()
const wantedAbi = expectedElectronAbi()

/** 現状が要求ターゲットを満たしているか。Electron は ABI 一致まで要求する。 */
const satisfied =
  target === "node"
    ? current.kind === "node"
    : current.kind === "electron" &&
      wantedAbi !== null &&
      current.abi === wantedAbi

if (satisfied) {
  console.log(
    `[ensure-sqlite-abi] better-sqlite3 は既に ${target} 向けです（ABI ${
      current.kind === "electron" ? current.abi : process.versions.modules
    }）。リビルド不要。`
  )
  process.exit(0)
}

const currentLabel =
  current.kind === "electron"
    ? `electron(ABI ${current.abi})`
    : current.kind === "node"
      ? "node"
      : "不明"
const targetLabel =
  target === "electron" && wantedAbi !== null
    ? `electron(ABI ${wantedAbi})`
    : target
console.log(
  `[ensure-sqlite-abi] better-sqlite3 を ${targetLabel} 向けにリビルドします（現在: ${currentLabel}）...`
)

// 既存バイナリを消してキャッシュ復元による上書きスキップを防ぐ。
// Electronのメジャー更新時は bin/<platform>-<abi>/ に旧ABIのキャッシュが残り、
// electron-rebuild がそれを復元して新ABI向けのビルドを省くことがあるため一緒に消す。
if (fs.existsSync(BUILD_RELEASE)) fs.rmSync(BUILD_RELEASE)
const BIN_CACHE = path.resolve(__dirname, "../node_modules/better-sqlite3/bin")
if (fs.existsSync(BIN_CACHE)) fs.rmSync(BIN_CACHE, { recursive: true })

const cmd =
  target === "electron"
    ? "npx electron-rebuild --only better-sqlite3 --build-from-source --force"
    : "npm rebuild better-sqlite3"

execSync(cmd, { stdio: "inherit" })

// 生成結果を検証（取り違え再発の早期検知）。
const after = detectCurrentTarget()
const afterSatisfied =
  target === "node"
    ? after.kind === "node"
    : after.kind === "electron" && wantedAbi !== null && after.abi === wantedAbi
if (!afterSatisfied) {
  const afterLabel =
    after.kind === "electron"
      ? `electron(ABI ${after.abi})`
      : after.kind === "node"
        ? "node"
        : "不明"
  console.error(
    `[ensure-sqlite-abi] リビルド後も ${targetLabel} 向けになっていません（実測: ${afterLabel}）。`
  )
  process.exit(1)
}

console.log(`[ensure-sqlite-abi] 完了（${targetLabel} 向け）。`)
