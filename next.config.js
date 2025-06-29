/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  images: {
    domains: ["localhost"], // 画像を置いているドメイン
  },
  reactStrictMode: false, // Strict Modeを無効化してテスト
}

module.exports = nextConfig
