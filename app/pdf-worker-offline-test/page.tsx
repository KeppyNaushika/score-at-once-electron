"use client"

import dynamic from "next/dynamic"

/**
 * PDF.js Worker オフライン動作テストページ
 *
 * このページでは以下をテスト:
 * - PDF.js Workerの初期化確認
 * - ローカルPDF Workerファイルの読み込み
 * - PDFファイルの読み込み・レンダリング
 * - Worker使用時とWorkerなし使用時の比較
 * - オフライン環境での完全動作
 */

// PDF.jsを動的インポートしてSSRを回避
const PDFWorkerTestContent = dynamic(() => import("./PDFWorkerTestContent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      Loading PDF.js...
    </div>
  ),
})

export default function PDFWorkerOfflineTestPage() {
  return <PDFWorkerTestContent />
}
