import type { PrintHtmlRequest } from "../ipcProtocol"

/**
 * HTML を画面の見えない `iframe` で描き、その `iframe` の印刷ダイアログを出す
 * （デスクトップ版のオフスクリーンのウィンドウでの printToPDF の代わり。頼むのは
 * `web/worker/htmlPrinting.ts`）。
 *
 * `srcdoc` の `iframe` はこの画面と同じオリジンで、画面の Service Worker の受け持ちも
 * 引き継ぐので、HTML の中の `/__appimg/` の画像も画面と同じく OPFS から読める。
 * 印刷ダイアログはベクタのまま描くので、「PDF に保存」を選べばデスクトップ版の
 * printToPDF と同じ Chromium の PDF になる。
 */

/** MathJax の描き終わりを待つ上限（デスクトップ版の `waitForRendering` と同じ） */
const MATHJAX_TIMEOUT_MS = 10_000
/** MathJax の無い HTML で、描き終わりを待つ時間（デスクトップ版と同じ） */
const LAYOUT_SETTLE_MS = 500

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

/** `iframe` の window に MathJax が読み込まれているか */
const hasMathJax = (frameWindow: Window) =>
  Reflect.get(frameWindow, "MathJax") !== undefined

/** プロパティを持てる値か（MathJax 4 の `startup` は関数にプロパティを足したもの） */
const isPropertyHolder = (candidate: unknown): candidate is object =>
  (typeof candidate === "object" && candidate !== null) ||
  typeof candidate === "function"

/**
 * MathJax の `startup.promise`（読み込みと最初の組版が済むと解決する）。まだ無ければ null。
 * `iframe` の中の Promise は別の realm のものなので、`instanceof Promise` では見分けられない
 */
const mathJaxStartupOf = (frameWindow: Window): PromiseLike<unknown> | null => {
  const mathJax: unknown = Reflect.get(frameWindow, "MathJax")
  if (!isPropertyHolder(mathJax)) return null
  const startup: unknown = Reflect.get(mathJax, "startup")
  if (!isPropertyHolder(startup)) return null
  const startupPromise: unknown = Reflect.get(startup, "promise")
  if (!isPropertyHolder(startupPromise)) return null
  const then: unknown = Reflect.get(startupPromise, "then")
  if (typeof then !== "function") return null
  return { then: then.bind(startupPromise) }
}

/**
 * MathJax の描き終わりを待つ（上限まで）。HTML が立てる `__mathjax_ready`（デスクトップ版の
 * `waitForRendering` が見る印）か、MathJax の `startup.promise` の解決
 */
const waitForMathJax = async (frameWindow: Window) => {
  const deadline = Date.now() + MATHJAX_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (Reflect.get(frameWindow, "__mathjax_ready") === true) return
    const startup = mathJaxStartupOf(frameWindow)
    if (startup !== null) {
      await Promise.race([startup, delay(deadline - Date.now())])
      return
    }
    await delay(100)
  }
  console.warn("[web] MathJax の描画を待ちきれなかったので、そのまま印刷する")
}

/** 画像の読み込みを待つ（読めなかった画像は待たない） */
const waitForImages = (frameDocument: Document) =>
  Promise.all(
    Array.from(frameDocument.images).map((image) =>
      image.decode().catch(() => undefined)
    )
  )

const loadFrame = (frame: HTMLIFrameElement, html: string) =>
  new Promise<Window>((resolve, reject) => {
    frame.addEventListener(
      "load",
      () => {
        const frameWindow = frame.contentWindow
        if (frameWindow === null) {
          reject(new Error("印刷用の HTML を読み込めませんでした"))
          return
        }
        resolve(frameWindow)
      },
      { once: true }
    )
    frame.srcdoc = html
  })

/** HTML を描いて印刷ダイアログを出す。ダイアログが閉じたら返る */
export async function printHtml(request: PrintHtmlRequest): Promise<void> {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.tabIndex = -1
  // 見えない所で描く。大きさはデスクトップ版のウィンドウ（A4 を 96 DPI）に合わせる
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;" +
    "opacity:0;pointer-events:none"
  document.body.append(frame)
  const pageTitle = document.title
  try {
    const frameWindow = await loadFrame(frame, request.html)
    const frameDocument = frameWindow.document
    await Promise.all([
      frameDocument.fonts.ready,
      waitForImages(frameDocument),
      hasMathJax(frameWindow)
        ? waitForMathJax(frameWindow)
        : delay(LAYOUT_SETTLE_MS),
    ])
    // 「PDF に保存」の既定のファイル名は、画面の題から付く
    document.title = request.title
    // Chromium では print() は印刷ダイアログが閉じるまで返らない（afterprint を待つと、
    // ダイアログを出さない環境（headless）では来ないまま止まる）
    frameWindow.print()
  } finally {
    document.title = pageTitle
    frame.remove()
  }
}
