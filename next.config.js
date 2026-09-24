/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /**
   * ビルド成果物の置き場。既定は `.next`。
   *
   * e2e は `NEXT_DIST_DIR` を別の名前にして走る。同じ作業ツリーで開発用サーバーが
   * 動いていることがあり、`.next` を共有すると互いのビルドを壊すため。
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * 左下の開発インジケーター（「N」の丸）。撮影では消す。公式サイトの使い方に
   * 貼る図に開発中の印が写るため。ビルドやランタイムのエラー表示は消えない。
   */
  ...(process.env.SCORE_AT_ONCE_HIDE_DEV_INDICATOR
    ? { devIndicators: false }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  reactStrictMode: false, // Strict Modeを無効化してテスト
  // PDF.jsワーカーファイルを静的ファイルとして配信
  async headers() {
    return [
      {
        source: "/js/pdf.worker.min.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
