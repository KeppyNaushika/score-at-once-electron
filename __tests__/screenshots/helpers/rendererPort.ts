/**
 * 撮影 e2e が使うレンダラーのポート。
 *
 * 既定の 3000 から外してある。同じ作業ツリーで開発用サーバーが動いていることが
 * あり、3000 番へ繋ぐと**そちらのコードに対して撮影が走る**（何を撮ったのかが
 * 分からなくなる）。Electron e2e が `tests/electron/helpers/rendererPort.ts` で
 * 同じ理由から外しているのと同じ判断で、その 3123 とも別の番号にして、両方が
 * 同時に走ってもポートを取り合わないようにする。
 */
export const SCREENSHOT_RENDERER_PORT = Number(
  process.env.SCREENSHOT_RENDERER_PORT ?? 3124
)

/** 撮影 e2e が開く URL の起点 */
export const SCREENSHOT_BASE_URL = `http://localhost:${SCREENSHOT_RENDERER_PORT}`
