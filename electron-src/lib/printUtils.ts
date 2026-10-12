/**
 * 印刷・PDF出力の窓口
 *
 * 画面で作った HTML をオフスクリーンの BrowserWindow に読み込み、printToPDF で PDF にする。
 *
 * 読み込む HTML は画面から届くので、中に何が入っていても害が出ないよう、その窓を閉じ込める:
 * - スクリプトを動かさない（`javascript: false`）。印刷する HTML（個人成績表・成績表・解答用紙）は
 *   どれも画面で描き切った静的な HTML で、数式も画面で SVG にしてから渡ってくる
 * - 印刷専用の、ディスクに残らないセッションで開き、自分の一時ファイルと `data:` 以外への
 *   読み込みをすべて断る（他のローカルファイルや外部へ届かない）
 * - 遷移・新しいウィンドウ・権限の要求を断る
 *
 * web 版にはオフスクリーンのウィンドウが無いので、書き出し（`scripts/web/buildWorker.mjs`）が
 * このファイルを `web/worker/htmlPrinting.ts` に差し替える（画面の印刷ダイアログを出す）。
 * 呼び出し側（`exportHandlers.ts`）は両方で同じ。
 */

import * as crypto from "crypto"
import type { Session } from "electron"
import { app, BrowserWindow, session, shell } from "electron"
import * as fsPromises from "fs/promises"
import * as path from "path"
import { fileURLToPath } from "url"

/** 用紙の大きさ。オブジェクトは mm */
export type PrintPageSize = "A4" | "Letter" | { width: number; height: number }

/** HTML を PDF ファイルに書き出すときの指定 */
export interface HtmlToPdfFileOptions {
  html: string
  filePath: string
  pageSize?: PrintPageSize
  landscape?: boolean
  /** 余白（インチ）。既定は各 0.2 インチ（≈5mm） */
  margins?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}

/** HTML を印刷用に開くときの指定 */
export interface HtmlPrintPreviewOptions {
  html: string
  title?: string
  pageSize?: PrintPageSize
  landscape?: boolean
}

/** 印刷専用セッションの名前。`persist:` を付けないので、ディスクに何も残らない */
const PRINT_PARTITION = "print-sandbox"

/** 印刷の窓が読み込んでよい一時ファイルのパス（同時に複数の印刷が走ることがある） */
const allowedPrintFilePaths = new Set<string>()

/** パスの比較用の形。Windows は大文字小文字を区別しない */
const toComparablePath = (filePath: string) => {
  const normalized = path.resolve(filePath)
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

/** 要求の URL が、今印刷している一時ファイルそのものか */
function isAllowedPrintFileUrl(url: string): boolean {
  if (!url.startsWith("file:")) return false
  try {
    return allowedPrintFilePaths.has(toComparablePath(fileURLToPath(url)))
  } catch {
    return false
  }
}

let printSession: Session | null = null

/**
 * 印刷専用のセッション。初めて使うときに一度だけ、読み込みと権限の要求を絞る。
 * 許すのは今印刷している一時ファイルそのものと、HTML に埋め込まれた `data:` の画像だけ
 */
function getPrintSession(): Session {
  if (printSession) return printSession
  const sandboxSession = session.fromPartition(PRINT_PARTITION)
  sandboxSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed =
      isAllowedPrintFileUrl(details.url) || details.url.startsWith("data:")
    callback({ cancel: !allowed })
  })
  sandboxSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )
  sandboxSession.setPermissionCheckHandler(() => false)
  printSession = sandboxSession
  return sandboxSession
}

/** 描画が落ち着くまでの待ち時間。スクリプトを動かさないので、読み込み後に一拍置くだけ */
const RENDER_SETTLE_MS = 500

/** pageSize が mm のオブジェクトなら、printToPDF が受け取るインチに変換する */
function toPrintToPdfPageSize(pageSize: PrintPageSize): PrintPageSize {
  if (typeof pageSize === "object") {
    return { width: pageSize.width / 25.4, height: pageSize.height / 25.4 }
  }
  return pageSize
}

/**
 * HTML をオフスクリーンのウィンドウに読み込んで PDF にする。
 * 一時ファイルにHTMLを書き込んでから読む（data URIは長すぎると失敗するため）。
 * 一時ファイルは毎回作る専用のフォルダに置き、終わればフォルダごと消す
 */
async function renderHtmlToPdf(options: {
  html: string
  pageSize: PrintPageSize
  landscape: boolean
  margins: { top: number; bottom: number; left: number; right: number }
}): Promise<Buffer> {
  // 実体のパスにそろえる（macOS の一時フォルダはシンボリックリンクを経る）。読み込みの許可は
  // このパスとの一致で判定する
  const tempDir = await fsPromises.realpath(
    await fsPromises.mkdtemp(
      path.join(app.getPath("temp"), "score-at-once-print-")
    )
  )
  const tempHtmlPath = path.join(tempDir, `${crypto.randomUUID()}.html`)

  const win = new BrowserWindow({
    width: 794, // A4 at 96 DPI
    height: 1123,
    show: false,
    webPreferences: {
      offscreen: true,
      session: getPrintSession(),
      javascript: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  })
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (event) => event.preventDefault())
  win.webContents.on("will-redirect", (event) => event.preventDefault())

  allowedPrintFilePaths.add(toComparablePath(tempHtmlPath))
  try {
    await fsPromises.writeFile(tempHtmlPath, options.html, {
      encoding: "utf-8",
      mode: 0o600,
    })

    await win.loadFile(tempHtmlPath)

    // 画像のデコードや段組みが落ち着くのを待つ
    await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS))

    return await win.webContents.printToPDF({
      pageSize: toPrintToPdfPageSize(options.pageSize),
      landscape: options.landscape,
      printBackground: true,
      margins: options.margins,
    })
  } finally {
    allowedPrintFilePaths.delete(toComparablePath(tempHtmlPath))
    win.destroy()
    // 一時ファイルを削除（失敗しても無視）
    await fsPromises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => undefined)
  }
}

/** ファイル名の長さの上限（拡張子・時刻を足す前の部分） */
const MAX_PREVIEW_NAME_LENGTH = 80

/**
 * 表示名（試験名など）を一時フォルダ直下に置ける1つのファイル名にする。
 * パスの区切り・OS が名前に使えない文字・制御文字を `_` に、先頭の `.` を落とし、
 * 長すぎれば切る。何も残らなければ既定の名前にする
 */
function toSafeFileName(name: string, fallback: string): string {
  const replaced = Array.from(name.normalize("NFC"))
    .map((character) =>
      /[\\/:*?"<>|]/.test(character) || /\p{Cc}|\p{Cf}/u.test(character)
        ? "_"
        : character
    )
    .join("")
    .replace(/^[.\s]+/, "")
    .replace(/[.\s]+$/, "")
  const truncated = Array.from(replaced)
    .slice(0, MAX_PREVIEW_NAME_LENGTH)
    .join("")
  return truncated === "" ? fallback : truncated
}

/** HTML を PDF にして `filePath` へ書く */
export async function printHtmlToPdfFile(
  options: HtmlToPdfFileOptions
): Promise<void> {
  // マージンはインチ単位、デフォルト5mm ≈ 0.2インチ
  const margins = options.margins || {}
  const pdfBuffer = await renderHtmlToPdf({
    html: options.html,
    pageSize: options.pageSize || "A4",
    landscape: options.landscape || false,
    margins: {
      top: margins.top ?? 0.2,
      bottom: margins.bottom ?? 0.2,
      left: margins.left ?? 0.2,
      right: margins.right ?? 0.2,
    },
  })
  await fsPromises.writeFile(options.filePath, pdfBuffer)
}

/**
 * HTML を PDF にして既定のアプリ（プレビュー.app など）で開く。利用者はそこから
 * 印刷・保存する
 */
export async function openHtmlPrintPreview(
  options: HtmlPrintPreviewOptions
): Promise<void> {
  const tempPdfPath = path.join(
    app.getPath("temp"),
    `${toSafeFileName(options.title ?? "", "個人成績表")}-${Date.now()}.pdf`
  )
  // マージンはCSSの@page marginに任せるため0に設定
  const pdfBuffer = await renderHtmlToPdf({
    html: options.html,
    pageSize: options.pageSize || "A4",
    landscape: options.landscape || false,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })
  // PDFは開いたままにするので削除しない（ユーザーが保存する可能性がある）
  await fsPromises.writeFile(tempPdfPath, pdfBuffer)
  await shell.openPath(tempPdfPath)
}
