import { app } from "electron"

/**
 * 画面（renderer）の出どころ。
 *
 * - 開発時: 外部の `next dev`（`http://localhost:<port>`）。ポートは既定 3000 で、
 *   `SCORE_AT_ONCE_RENDERER_PORT` で変えられる。e2e と撮影はこれを使って開発用サーバーと
 *   別のポートで走らせる（同じ 3000 番を使うと、隣で動いている開発用サーバーのコードに
 *   対してテストしてしまう）
 * - パッケージ版: 独自のスキーム `app://score-at-once`。画面の静的書き出しを main が
 *   直接返す（`rendererProtocol.ts`）。ポートを開かないので、ほかのアプリが 3000 番を
 *   使っていても起動できる
 */

/** パッケージ版が画面を配るスキーム */
export const RENDERER_SCHEME = "app"

/** パッケージ版の画面の URL のホスト。スキームの中で画面を指す名前 */
export const RENDERER_HOST = "score-at-once"

const rendererPort = Number(process.env.SCORE_AT_ONCE_RENDERER_PORT ?? 3000)

/** 画面の入口 URL（末尾の `/` は付けない） */
export const rendererOrigin = app.isPackaged
  ? `${RENDERER_SCHEME}://${RENDERER_HOST}`
  : `http://localhost:${rendererPort}`

/**
 * URL が画面のものか。
 *
 * `URL.origin` では比べない。Node の URL は、http・https など以外のスキームの origin を
 * すべて `"null"` にするので、`app://` 同士の比較が `foo://` のような別のスキームにも
 * 一致してしまう。スキームとホスト（ポートを含む）をそれぞれ比べる
 */
export function isRendererUrl(url: string): boolean {
  try {
    const target = new URL(url)
    const renderer = new URL(rendererOrigin)
    return (
      target.protocol === renderer.protocol && target.host === renderer.host
    )
  } catch {
    return false
  }
}
