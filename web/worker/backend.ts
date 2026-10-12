/**
 * web 版の module Worker の入口。main のハンドラ（`setupAllIPCHandlers`）を書き換えずに動かし、
 * 画面からの `invoke` をそこへ渡す（通信の型は `web/ipcProtocol.ts`）。
 *
 * 起動の順はデスクトップ版の `initializeApp`（`electron-src/appInitializer.ts`）に倣い、web 版で
 * 意味のある段だけを同じモジュールを呼んで行う:
 *
 * 1. 端末ごとの設定ファイル（auth.json・AI の事業者設定）を読む
 * 2. データの根を決める（ローカルモードの根を `/opfs/data` に。共有モードは無い）
 * 3. アプリの DB を開く（`appDatabase.ts`）。開けたら、前の起動の一時ファイルとダウンロードの
 *    置き場を消して作り直す
 * 4. データディレクトリを作る（`initializeDataDirectory`）
 * 5. 初期スキーマ・マイグレーション・見本のデータ（`DatabaseSetup`。新規 DB の `_prisma_migrations` も
 *    デスクトップ版と同じになる）
 * 6. 答案に重ねる要素の長さを mm へ（migration の続き）・接続の確認
 * 7. ハンドラを登録する
 *
 * 呼ばない段: 共有モードの判定と旧版からの引き継ぎ（`prepareStorageAtStartup`）・NAS 同期・
 * v0.6.x のリネーム（projects/ → exams/。web 版に旧版のデータは無い）・共有ドライブ向けの
 * PRAGMA（WAL は sahpool で使えず、共有ドライブも無い）・シングルインスタンスの確保。
 *
 * 起動が終わる前に届いた `invoke`/`send` は溜めておき、終わったら来た順に処理する。
 * `stageFile` は起動を待たずにすぐ結び付ける（後から来る `invoke` が必ずそのパスを読めるように）。
 * Worker から画面への頼みの返事（`filesOpened`・`htmlPrinted`）も、待っている処理へすぐ渡す。
 */
import "./workerGlobals"

import type { PageToWorkerMessage, WorkerToPageMessage } from "../ipcProtocol"
import { createIpcEvent, findIpcHandler } from "./electronShim"
import { settlePageRequest } from "./pageRequests"
import { stageFile } from "./stagedFiles"
import { WEB_DATA_DIRECTORY, WEB_TEMP_DIRECTORY } from "./webPaths"

type DispatchedMessage = Extract<
  PageToWorkerMessage,
  { kind: "invoke" | "send" }
>

const postToPage = (message: WorkerToPageMessage) => postMessage(message)

const pendingMessages: DispatchedMessage[] = []
let dispatch: ((message: DispatchedMessage) => void) | null = null

addEventListener("message", (event: MessageEvent<PageToWorkerMessage>) => {
  const message = event.data
  if (message.kind === "stageFile") {
    stageFile(message.path, message.file)
    return
  }
  if (message.kind === "filesOpened" || message.kind === "htmlPrinted") {
    settlePageRequest(message)
    return
  }
  if (dispatch === null) {
    pendingMessages.push(message)
    return
  }
  dispatch(message)
})

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** 起動の段（上の 1〜7） */
async function boot(): Promise<void> {
  const [
    { AuthStoreManager },
    { getProviderCredentialStore },
    { computeLocalRoots, fixStorageRoots, getStorageRoots },
    { openAppDatabaseHost },
    { mkdir, rm },
    { prepareDownloadStaging },
  ] = await Promise.all([
    import("../../electron-src/lib/authStore"),
    import("../../electron-src/lib/aiGrading/providerCredentialStore"),
    import("../../electron-src/lib/storageRoots"),
    import("./appDatabase"),
    import("./opfsFs"),
    import("./downloadArea"),
  ])

  await Promise.all([
    AuthStoreManager.load(),
    getProviderCredentialStore().load(),
  ])

  fixStorageRoots(computeLocalRoots(WEB_DATA_DIRECTORY))
  const { sqlite3 } = await openAppDatabaseHost(getStorageRoots().databasePath)
  console.info(`[web] SQLite ${sqlite3.version.libVersion} (opfs-sahpool)`)

  // 前に起こしたとき（やタブを閉じて途中で終わったとき）の一時ファイルを丸ごと消してから作り直す。
  // 展開した統合アーカイブ・書き出し途中のファイル・復号した PDF の複製が残りうる（デスクトップ版が
  // 起動時に復号した PDF の複製を消し、終了時に取り込みの作業ディレクトリを消すのと同じ意味）。
  // DB を開けた＝このタブがデータを専有している（`web/page/entry.ts` のロックと sahpool）ので、
  // 別のタブの Worker が使っている途中のものを消すことはない。ハンドラの登録より前なので、
  // この Worker の処理もまだ何も置いていない
  await rm(WEB_TEMP_DIRECTORY, { recursive: true, force: true })
  // os.tmpdir() / app.getPath("temp")。mkdtemp は親が要る
  await mkdir(WEB_TEMP_DIRECTORY, { recursive: true })
  await prepareDownloadStaging()

  const [
    { getAbsolutePathFromSharedFiles, initializeDataDirectory },
    { DatabaseSetup },
    { convertPendingAnswerOverlayLengths },
    { getPrismaClient },
    { checkDatabaseHealth },
  ] = await Promise.all([
    import("../../electron-src/lib/dataManager"),
    import("../../electron-src/lib/databaseSetup"),
    import("../../electron-src/lib/prisma/answerOverlayLengthConversion"),
    import("../../electron-src/lib/prisma/client"),
    import("../../electron-src/lib/prisma/databaseHealth"),
  ])

  await initializeDataDirectory()

  const wasSetupRequired = await new DatabaseSetup().setupIfNeeded()
  console.info(
    wasSetupRequired
      ? "[web] Database initialized and seeded"
      : "[web] Database already exists and is ready"
  )

  // デスクトップ版と同じく、失敗しても起動は止めない（描画は画素の行をそのまま描く）
  try {
    await convertPendingAnswerOverlayLengths(
      getPrismaClient(),
      getAbsolutePathFromSharedFiles
    )
  } catch (error) {
    console.error(
      "[web] Failed to convert answer overlay lengths to mm:",
      error
    )
  }

  if (!(await checkDatabaseHealth())) {
    throw new Error("Database health check failed")
  }

  const { setupAllIPCHandlers } =
    await import("../../electron-src/ipc-handlers/index")
  setupAllIPCHandlers()
}

/** 起動後の `invoke`。返す値はハンドラの返り値そのもの（`registerChannel` が包んだ `{ __ipc }`） */
async function handleInvoke(
  message: Extract<DispatchedMessage, { kind: "invoke" }>
): Promise<void> {
  const handler = findIpcHandler(message.channel)
  if (handler === null) {
    postToPage({
      kind: "replyError",
      id: message.id,
      message: `No handler registered for '${message.channel}'`,
    })
    return
  }
  try {
    const value = await handler(createIpcEvent(), ...message.args)
    postToPage({ kind: "reply", id: message.id, value })
  } catch (error) {
    // 登録したハンドラは例外を `{ __ipc: "failed" }` に包むので、ここに来るのは返り値を
    // 送れなかった（構造化複製できない値を返した）とき
    postToPage({
      kind: "replyError",
      id: message.id,
      message: `[${message.channel}] ${errorMessageOf(error)}`,
    })
  }
}

const handleMessage = (message: DispatchedMessage) => {
  if (message.kind === "invoke") {
    void handleInvoke(message)
    return
  }
  // ipcRenderer.send を受けるハンドラ（ipcMain.on）は main に無い
  console.warn(`[web] send '${message.channel}' を受けるハンドラは無い`)
}

boot().then(
  () => {
    dispatch = handleMessage
    pendingMessages.splice(0).forEach(handleMessage)
    postToPage({ kind: "ready" })
  },
  (error: unknown) => {
    console.error("[web] Worker の起動に失敗した:", error)
    dispatch = (message) => {
      if (message.kind !== "invoke") return
      postToPage({
        kind: "replyError",
        id: message.id,
        message: `起動に失敗した: ${errorMessageOf(error)}`,
      })
    }
    pendingMessages.splice(0).forEach((message) => dispatch?.(message))
    postToPage({ kind: "bootFailed", message: errorMessageOf(error) })
  }
)
