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
 * 現在 build/Release に置かれているバイナリのターゲットを判定する。
 *
 * 必ず子プロセスで判定する: ネイティブ部は一度 new Database() で開くとプロセス内に
 * キャッシュ＆メモリマップされ、その後ファイルを差し替えても同一プロセスからは
 * 古いバイナリが見え続ける。リビルド前後で同じプロセスから判定すると誤検知するため。
 *
 * require() はネイティブ部を遅延ロードするので、実際に DB を開いて dlopen を強制する。
 * @returns {"node"|"electron"|"none"}
 *   - "node":     素のNodeで開けた = Node向けビルド
 *   - "electron": ABI不一致で開けない = Electron向けビルド
 *   - "none":     バイナリ欠落など判定不能 = 要リビルド
 */
function detectCurrentTarget() {
  const probe =
    "try{const D=require('better-sqlite3');new D(':memory:').close();" +
    "process.stdout.write('node')}" +
    "catch(e){process.stdout.write(String(e&&e.message).includes('NODE_MODULE_VERSION')?'electron':'none')}"
  try {
    const out = execSync(`node -e "${probe}"`, {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "ignore"],
    })
    return out.toString().trim() || "none"
  } catch {
    return "none"
  }
}

const current = detectCurrentTarget()

if (current === target) {
  console.log(
    `[ensure-sqlite-abi] better-sqlite3 は既に ${target} 向けです。リビルド不要。`
  )
  process.exit(0)
}

console.log(
  `[ensure-sqlite-abi] better-sqlite3 を ${target} 向けにリビルドします（現在: ${current}）...`
)

// 既存バイナリを消してキャッシュ復元による上書きスキップを防ぐ。
if (fs.existsSync(BUILD_RELEASE)) fs.rmSync(BUILD_RELEASE)

const cmd =
  target === "electron"
    ? "npx electron-rebuild --only better-sqlite3 --build-from-source --force"
    : "npm rebuild better-sqlite3"

execSync(cmd, { stdio: "inherit" })

// 生成結果を検証（取り違え再発の早期検知）。
const after = detectCurrentTarget()
if (after !== target) {
  console.error(
    `[ensure-sqlite-abi] リビルド後も ${target} 向けになっていません（実測: ${after}）。`
  )
  process.exit(1)
}

console.log(`[ensure-sqlite-abi] 完了（${target} 向け）。`)
