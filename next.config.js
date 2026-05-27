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
