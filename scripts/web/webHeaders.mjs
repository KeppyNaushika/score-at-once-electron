/**
 * web 版を配るときに付けるヘッダー（CSP など）の定義。**定義はここ1か所だけ。**
 *
 * - 本番（Cloudflare Pages）: `scripts/web/buildWeb.mjs` が `renderHeadersFile` で
 *   `web-dist/_headers` を書き出す
 * - 手元（`scripts/web/serveWeb.mjs`）: `headersForPath` で同じ規則を当てる
 *
 * 原則は「ホストは何も受け取らない・何も送らない」。CSP で外への接続を許さず
 * （`'self'` と `data:`・`blob:` だけ）、違反の報告先（`report-uri`・`report-to`）も付けない。
 *
 * CSP は3つの層で当てる:
 *
 * 1. **画面の HTML:** 各 HTML の `<head>` の先頭に `<meta http-equiv="Content-Security-Policy">`
 *    を差し込む（`addPageHeadElements`）。Next の書き出しは HTML ごとに中身の違うインラインの
 *    `<script>`（`self.__next_f.push(...)`）を持つので、HTML ごとにその sha256 を許す。
 *    meta は HTML と一緒に動くので、動的ルートの殻（`src/lib/routeShell.ts`）を実際の id の
 *    URL で配っても、そのまま当たる
 * 2. **全体のヘッダー（`/*`）:** meta では書けないもの（`frame-ancestors`）を含む全体の CSP。
 *    インラインのスクリプトの許可はここでは絞らず（`'unsafe-inline'`）、HTML では 1 の meta が
 *    ハッシュで絞る（CSP が2つあると両方が効くので、通るのは両方が許すものだけ）。HTML 以外
 *    （Service Worker・pdf.js の Worker）はインラインのスクリプトを持たない
 * 3. **main の処理を動かす Worker（`/__web/worker/*`）:** wasm-vips（embind）が `eval` を使う
 *    ので、Worker にだけ `'unsafe-eval'` を許す。Worker の CSP は Worker のスクリプトの
 *    応答のヘッダーで決まる（画面の CSP は継がない）。全体の CSP と重なると両方が効いて
 *    `eval` が止まるので、全体の CSP を外してから付け直す（`_headers` の `! 名前`）
 *
 * Service Worker が作る `/__appimg/` の応答は配信を通らないので、ヘッダーは Service Worker の
 * コードで付ける（`web/serviceWorker/appImageResponse.ts`）。
 */
import { createHash } from "node:crypto"

/** CSP の指令の並び（名前 → 許すもの）を、ヘッダーの値の文字列にする */
const serializePolicy = (directives) =>
  Object.entries(directives)
    .map(([directiveName, sources]) =>
      [directiveName, ...sources].join(" ").trim()
    )
    .join("; ")

/**
 * 画面の CSP の指令（スクリプト以外）。
 *
 * - `style-src 'unsafe-inline'`: 実行中に足される `<style>`（MathJax・トースト・印刷の iframe）
 *   と `style` 属性のため
 * - `img-src` / `connect-src` の `data:`・`blob:`: 画面で作る画像（canvas・SVG の Blob）と、
 *   画面から Worker へ渡すファイル
 * - `worker-src 'self'`: 画面が起こす Worker（main の処理・pdf.js）と Service Worker は自分の
 *   オリジンの URL から。MathJax の読み上げは blob: の URL から Worker を作るが、読み上げは
 *   切ってある（`public/js/mathJaxConfig.js`。意味付けと読み上げが両方入っているときだけ起こす）
 * - `frame-src 'self'`: 印刷の見えない iframe（`srcdoc`。`web/page/htmlPrinter.ts`）
 */
const PAGE_DIRECTIVES_EXCEPT_SCRIPT = {
  "default-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", "data:", "blob:"],
  "worker-src": ["'self'"],
  "frame-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "manifest-src": ["'self'"],
}

/** 画面で wasm を動かす（pdf.js など）ための許可。`eval` は許さない */
const PAGE_SCRIPT_SOURCES = ["'self'", "'wasm-unsafe-eval'"]

/** インラインのスクリプトの中身の sha256（CSP の `'sha256-…'` の形） */
export const inlineScriptHashSource = (scriptText) =>
  `'sha256-${createHash("sha256").update(scriptText, "utf8").digest("base64")}'`

/**
 * 画面の HTML に meta で差し込む CSP。インラインのスクリプトは、渡したハッシュのものだけ。
 * meta では `frame-ancestors` を書けない（書いても効かない）ので、全体のヘッダーに置く
 */
export const pageContentSecurityPolicy = (inlineScriptHashSources) =>
  serializePolicy({
    ...PAGE_DIRECTIVES_EXCEPT_SCRIPT,
    "script-src": [...PAGE_SCRIPT_SOURCES, ...inlineScriptHashSources],
  })

/** 全体のヘッダーの CSP（HTML では meta の CSP と重なって効く） */
const SITE_CONTENT_SECURITY_POLICY = serializePolicy({
  ...PAGE_DIRECTIVES_EXCEPT_SCRIPT,
  "script-src": [...PAGE_SCRIPT_SOURCES, "'unsafe-inline'"],
  "frame-ancestors": ["'none'"],
})

/**
 * main の処理を動かす Worker の CSP。wasm-vips（embind）が `eval`・`new Function` を、
 * Prisma の query compiler・sqlite3・vips の wasm が `'wasm-unsafe-eval'` を要る。
 * vips は pthread 用の Worker を同じ置き場の URL から起こす（`worker-src 'self'`）
 */
const WORKER_CONTENT_SECURITY_POLICY = serializePolicy({
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
  "connect-src": ["'self'", "data:", "blob:"],
  "img-src": ["'self'", "data:", "blob:"],
  "worker-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "frame-ancestors": ["'none'"],
})

/**
 * 使わないブラウザの機能を塞ぐ。アプリが使うもの（全画面・画面消灯の抑止
 * `src/hooks/useScreenWakeLock.ts`・クリップボード）は自分のオリジンにだけ許す
 */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "bluetooth=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
  "clipboard-read=(self)",
  "clipboard-write=(self)",
  "fullscreen=(self)",
  "screen-wake-lock=(self)",
].join(", ")

/**
 * ヘッダーの規則。Cloudflare Pages の `_headers` と同じ意味で読む:
 * 要求のパスに当たる規則を上から順に当て、`detach` の名前を外してから `headers` を付ける
 * （外さずに同じ名前を付けると、値がカンマでつながって両方が効く）。
 * `pattern` は完全一致か、末尾の `*` で前方一致
 */
export const HEADER_RULES = [
  {
    pattern: "/*",
    detach: [],
    headers: {
      // 画像処理の wasm（wasm-vips）が SharedArrayBuffer を使うので cross-origin isolation が要る
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": SITE_CONTENT_SECURITY_POLICY,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": PERMISSIONS_POLICY,
      // HTML・Service Worker・入口（page.js・worker.js）は名前が版で変わらないので、毎回確かめさせる
      "Cache-Control": "no-cache",
    },
  },
  {
    pattern: "/__web/worker/*",
    detach: ["Content-Security-Policy"],
    headers: {
      "Content-Security-Policy": WORKER_CONTENT_SECURITY_POLICY,
    },
  },
  {
    // Next の書き出しの資源は名前に中身のハッシュが入り、版が変われば名前も変わるので、長く持たせる
    pattern: "/_next/static/*",
    detach: ["Cache-Control"],
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  },
]

const matchesPattern = (pattern, urlPath) =>
  pattern.endsWith("*")
    ? urlPath.startsWith(pattern.slice(0, -1))
    : urlPath === pattern

/** 要求のパス（クエリを除いた URL のパス）に付けるヘッダー。`_headers` と同じ当て方 */
export const headersForPath = (urlPath) => {
  const headers = new Map()
  for (const rule of HEADER_RULES) {
    if (!matchesPattern(rule.pattern, urlPath)) continue
    for (const headerName of rule.detach) headers.delete(headerName)
    for (const [headerName, headerValue] of Object.entries(rule.headers)) {
      const attached = headers.get(headerName)
      headers.set(
        headerName,
        attached === undefined ? headerValue : `${attached}, ${headerValue}`
      )
    }
  }
  return Object.fromEntries(headers)
}

/** Cloudflare Pages の `_headers` の1行の上限（これを超える行は効かない） */
const HEADERS_FILE_LINE_LIMIT = 2000

/** `web-dist/_headers` の中身 */
export const renderHeadersFile = () => {
  const lines = HEADER_RULES.flatMap((rule) => [
    rule.pattern,
    ...rule.detach.map((headerName) => `  ! ${headerName}`),
    ...Object.entries(rule.headers).map(
      ([headerName, headerValue]) => `  ${headerName}: ${headerValue}`
    ),
  ])
  const tooLong = lines.find((line) => line.length > HEADERS_FILE_LINE_LIMIT)
  if (tooLong !== undefined) {
    throw new Error(
      `_headers の行が ${HEADERS_FILE_LINE_LIMIT} 文字を超えました: ${tooLong.slice(0, 80)}…`
    )
  }
  return `${lines.join("\n")}\n`
}

const HEAD_OPEN_TAG = /<head(\s[^>]*)?>/i
const SCRIPT_ELEMENT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const SRC_ATTRIBUTE = /\ssrc\s*=/i

/** HTML の中のインラインの `<script>`（`src` の無いもの）の中身 */
export const inlineScriptTexts = (html) =>
  Array.from(html.matchAll(SCRIPT_ELEMENT))
    .filter(([, attributes]) => !SRC_ATTRIBUTE.test(attributes))
    .map(([, , scriptText]) => scriptText)

/** meta の `content` に入れる値（CSP の値は `"` も `&` も含まないが、念のためエスケープする） */
const escapeAttribute = (attributeValue) =>
  attributeValue.replaceAll("&", "&amp;").replaceAll('"', "&quot;")

/**
 * 画面の HTML の `<head>` の先頭に、CSP の meta と入口のスクリプトをこの順で差し込む。
 *
 * meta は、それより後に出てくる要素にしか効かないので一番前に置く。入口は `async` を
 * 付けないので、後に続く Next のスクリプトより先に動く。インラインのスクリプトの
 * ハッシュは、差し込んだあとの HTML から取る（入口は外のファイルなので数えない）
 */
export const addPageHeadElements = (html, { pageScriptPath }) => {
  const headOpenTag = html.match(HEAD_OPEN_TAG)
  if (!headOpenTag) {
    throw new Error("<head> がありません")
  }
  const hashSources = [
    ...new Set(inlineScriptTexts(html).map(inlineScriptHashSource)),
  ]
  const policy = pageContentSecurityPolicy(hashSources)
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"/>`
  const pageScriptTag = `<script src="${pageScriptPath}"></script>`
  return html.replace(
    HEAD_OPEN_TAG,
    (headTag) => headTag + metaTag + pageScriptTag
  )
}
