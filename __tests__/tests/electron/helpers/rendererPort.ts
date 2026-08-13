/**
 * e2e が使うレンダラーのポート。
 *
 * 既定を 3000 から外してある。同じ作業ツリーで開発用サーバーが動いていることが
 * あり、3000 番をそのまま使うと**そちらのコードに対してテストしてしまう**ため。
 * `E2E_RENDERER_PORT` で変えられる。
 */
export const E2E_RENDERER_PORT = Number(process.env.E2E_RENDERER_PORT ?? 3123)

/** e2e が開く URL の起点 */
export const E2E_BASE_URL = `http://localhost:${E2E_RENDERER_PORT}`
