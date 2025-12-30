/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  reactStrictMode: false, // Strict Modeを無効化してテスト
  // @react-pdf/renderer をサーバー外部パッケージとして扱い、
  // Next.jsのモジュールトレースキャッシュからハッシュ付きシンボリックリンクが
  // 作成されるのを防ぐ（Electronパッケージング時のエラー回避）
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/primitives",
    "@react-pdf/reconciler",
    "@react-pdf/render",
    "@react-pdf/types",
    "@react-pdf/fns",
    "@react-pdf/image",
    "@react-pdf/png-js",
    "@react-pdf/stylesheet",
    "@react-pdf/textkit",
  ],
  // モジュールトレースから@react-pdf関連パッケージを除外
  // これによりハッシュ付きシンボリックリンクの生成を防ぐ
  outputFileTracingExcludes: {
    "*": ["node_modules/@react-pdf/**"],
  },
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
