/**
 * web 版で、画面（preload を束ねたもの）と main の処理を動かす Worker の間を行き来する通信の型。
 *
 * デスクトップ版の IPC の代わり。Worker では main のハンドラ（`setupAllIPCHandlers`）を
 * 書き換えずに動かし、`ipcMain.handle` に登録された関数をここで受けた `invoke` から呼ぶ。
 * 返す値はハンドラの返り値そのもの（`registerChannel` が包んだ `{ __ipc }` の形）で、
 * Worker では包み直さない。
 */

/** 画面 → Worker */
export type PageToWorkerMessage =
  | { kind: "invoke"; id: number; channel: string; args: unknown[] }
  | { kind: "send"; channel: string; args: unknown[] }
  /**
   * 画面で選ばれたファイルを、Worker の仮想パスに置く。
   * `webUtils.getPathForFile` は同期で仮想パスを返し、同時にこれを送る。postMessage は
   * 送った順に届くので、そのパスを使う `invoke` より必ず先に Worker へ着く。
   * 中身は Worker が読むときに `File` から読む（画面では読まない）。
   */
  | { kind: "stageFile"; path: string; file: File }
  /**
   * `openFiles` への返事。選ばれたファイルは、先に `stageFile` で仮想パスに結び付けてから
   * そのパスを返す（送った順に届くので、Worker がパスを受け取った時点で読める）。
   * 選ばずに閉じたら null
   */
  | { kind: "filesOpened"; requestId: number; filePaths: string[] | null }
  /** `printHtml` への返事。印刷ダイアログが閉じたら返す。描けなかったときは理由 */
  | { kind: "htmlPrinted"; requestId: number; failure: string | null }

/**
 * 開くダイアログ（`dialog.showOpenDialog`）の代わりに、画面にファイルを選ばせる頼み。
 * フォルダは頼まない（web 版で選んだフォルダは保存の領域になる。`web/worker/electronShim.ts`）
 */
export interface OpenFilesRequest {
  /** ダイアログの題。選択を出せずに案内を出すときに見せる */
  title: string | null
  multiple: boolean
  /** 受け付ける拡張子（ドット無し）。null なら何でも */
  extensions: string[] | null
}

/**
 * HTML を画面で描いて印刷ダイアログを出す頼み（オフスクリーンのウィンドウでの printToPDF の代わり。
 * `web/worker/htmlPrinting.ts`）。用紙の大きさ・余白は `html` の `@page` に入れてある
 */
export interface PrintHtmlRequest {
  html: string
  /** 印刷している間の画面の題。印刷ダイアログの「PDF に保存」の既定のファイル名になる */
  title: string
}

/** Worker → 画面 */
export type WorkerToPageMessage =
  | { kind: "reply"; id: number; value: unknown }
  /** ハンドラが無い、または返り値を送れなかったとき。ハンドラ内の失敗は `reply` の `{ __ipc }` で返る */
  | { kind: "replyError"; id: number; message: string }
  /** `webContents.send(channel, payload)` の代わり */
  | { kind: "push"; channel: string; payload: unknown }
  | { kind: "openExternal"; url: string }
  /**
   * 保存ダイアログで選ばれた先へ書き終えたファイル。画面がダウンロードとして渡す。
   * 大きなものは OPFS にある `File` のまま届く（`web/worker/downloadArea.ts`）
   */
  | { kind: "download"; fileName: string; contents: Blob }
  /** 画面にファイルを選ばせる。返事は `filesOpened` */
  | { kind: "openFiles"; requestId: number; request: OpenFilesRequest }
  /** 画面で HTML を印刷する。返事は `htmlPrinted` */
  | { kind: "printHtml"; requestId: number; request: PrintHtmlRequest }
  | { kind: "ready" }
  | { kind: "bootFailed"; message: string }
