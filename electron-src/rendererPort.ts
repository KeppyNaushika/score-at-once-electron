/**
 * レンダラー（Next.js）を載せるポート。
 *
 * 既定は 3000。`SCORE_AT_ONCE_RENDERER_PORT` で変えられる。e2e はこれを使って
 * 開発用サーバーと別のポートで走らせる（同じ 3000 番を使うと、隣で動いている
 * 開発用サーバーのコードに対してテストしてしまう）。
 *
 * 開発時は外部の `next dev`、パッケージ化時は同梱サーバーが同じポートを使う。
 */
export const rendererPort = Number(
  process.env.SCORE_AT_ONCE_RENDERER_PORT ?? 3000
)

/** レンダラーの入口 URL */
export const rendererOrigin = `http://localhost:${rendererPort}`
