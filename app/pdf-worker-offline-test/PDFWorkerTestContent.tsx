"use client"

import * as pdfjs from "pdfjs-dist"
import { useState } from "react"

export default function PDFWorkerTestContent() {
  const [workerStatus, setWorkerStatus] = useState<
    "loading" | "ready" | "error"
  >("loading")
  const [workerUrl, setWorkerUrl] = useState<string>("")
  const [testResults, setTestResults] = useState({
    workerInitialized: false,
    pdfLoaded: false,
    pageRendered: false,
    workerlessTest: false,
  })

  // Worker初期化テスト
  const initializeWorker = async () => {
    try {
      setWorkerStatus("loading")

      // 1. 現在のworkerSrcを確認
      const currentWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc
      console.log("Current worker src:", currentWorkerSrc)

      // 2. ローカルのWorkerファイルを設定
      const localWorkerUrl = "/js/pdf.worker.min.mjs"

      // ファイルの存在確認
      const response = await fetch(localWorkerUrl)
      if (!response.ok) {
        throw new Error(`Worker file not found: ${response.status}`)
      }

      // 3. Worker URLを設定
      pdfjs.GlobalWorkerOptions.workerSrc = localWorkerUrl
      setWorkerUrl(localWorkerUrl)

      setWorkerStatus("ready")
      setTestResults((prev) => ({
        ...prev,
        workerInitialized: true,
      }))

      console.log("Worker initialized successfully")
    } catch (error) {
      console.error("Worker initialization failed:", error)
      setWorkerStatus("error")
    }
  }

  // 簡単なPDFを生成してテスト
  const createTestPDF = () => {
    // 最小限のPDFバイト列（"Hello PDF"を含む1ページのPDF）
    const pdfBytes = new Uint8Array([
      0x25,
      0x50,
      0x44,
      0x46,
      0x2d,
      0x31,
      0x2e,
      0x34, // %PDF-1.4
      0x0a,
      0x31,
      0x20,
      0x30,
      0x20,
      0x6f,
      0x62,
      0x6a, // \n1 0 obj
      0x0a,
      0x3c,
      0x3c,
      0x2f,
      0x54,
      0x79,
      0x70,
      0x65, // \n<</Type
      0x2f,
      0x43,
      0x61,
      0x74,
      0x61,
      0x6c,
      0x6f,
      0x67, // /Catalog
      0x2f,
      0x50,
      0x61,
      0x67,
      0x65,
      0x73,
      0x20,
      0x32, // /Pages 2
      0x20,
      0x30,
      0x20,
      0x52,
      0x3e,
      0x3e,
      0x0a,
      0x65, //  0 R>>\ne
      0x6e,
      0x64,
      0x6f,
      0x62,
      0x6a,
      0x0a,
      0x32,
      0x20, // ndobj\n2
      0x30,
      0x20,
      0x6f,
      0x62,
      0x6a,
      0x0a,
      0x3c,
      0x3c, // 0 obj\n<<
      0x2f,
      0x54,
      0x79,
      0x70,
      0x65,
      0x2f,
      0x50,
      0x61, // /Type/Pa
      0x67,
      0x65,
      0x73,
      0x2f,
      0x4b,
      0x69,
      0x64,
      0x73, // ges/Kids
      0x5b,
      0x33,
      0x20,
      0x30,
      0x20,
      0x52,
      0x5d,
      0x2f, // [3 0 R]/
      0x43,
      0x6f,
      0x75,
      0x6e,
      0x74,
      0x20,
      0x31,
      0x3e, // Count 1>
      0x3e,
      0x0a,
      0x65,
      0x6e,
      0x64,
      0x6f,
      0x62,
      0x6a, // >\nendobj
      0x0a,
      0x33,
      0x20,
      0x30,
      0x20,
      0x6f,
      0x62,
      0x6a, // \n3 0 obj
      0x0a,
      0x3c,
      0x3c,
      0x2f,
      0x54,
      0x79,
      0x70,
      0x65, // \n<</Type
      0x2f,
      0x50,
      0x61,
      0x67,
      0x65,
      0x2f,
      0x50,
      0x61, // /Page/Pa
      0x72,
      0x65,
      0x6e,
      0x74,
      0x20,
      0x32,
      0x20,
      0x30, // rent 2 0
      0x20,
      0x52,
      0x2f,
      0x4d,
      0x65,
      0x64,
      0x69,
      0x61, //  R/Media
      0x42,
      0x6f,
      0x78,
      0x5b,
      0x30,
      0x20,
      0x30,
      0x20, // Box[0 0
      0x36,
      0x31,
      0x32,
      0x20,
      0x37,
      0x39,
      0x32,
      0x5d, // 612 792]
      0x3e,
      0x3e,
      0x0a,
      0x65,
      0x6e,
      0x64,
      0x6f,
      0x62, // >>\nendob
      0x6a,
      0x0a,
      0x78,
      0x72,
      0x65,
      0x66,
      0x0a,
      0x30, // j\nxref\n0
      0x20,
      0x34,
      0x0a,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30, //  4\n00000
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x20,
      0x36,
      0x35, // 00000 65
      0x35,
      0x33,
      0x35,
      0x20,
      0x66,
      0x20,
      0x0a,
      0x30, // 535 f \n0
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30, // 00000000
      0x39,
      0x20,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x20, // 9 00000
      0x6e,
      0x20,
      0x0a,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30, // n \n00000
      0x30,
      0x30,
      0x30,
      0x37,
      0x34,
      0x20,
      0x30,
      0x30, // 00074 00
      0x30,
      0x30,
      0x30,
      0x20,
      0x6e,
      0x20,
      0x0a,
      0x30, // 000 n \n0
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x31,
      0x34,
      0x31, // 0000141
      0x20,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x20,
      0x6e, //  00000 n
      0x20,
      0x0a,
      0x74,
      0x72,
      0x61,
      0x69,
      0x6c,
      0x65, //  \ntraile
      0x72,
      0x0a,
      0x3c,
      0x3c,
      0x2f,
      0x53,
      0x69,
      0x7a, // r\n<</Siz
      0x65,
      0x20,
      0x34,
      0x2f,
      0x52,
      0x6f,
      0x6f,
      0x74, // e 4/Root
      0x20,
      0x31,
      0x20,
      0x30,
      0x20,
      0x52,
      0x3e,
      0x3e, //  1 0 R>>
      0x0a,
      0x73,
      0x74,
      0x61,
      0x72,
      0x74,
      0x78,
      0x72, // \nstartxr
      0x65,
      0x66,
      0x0a,
      0x32,
      0x32,
      0x39,
      0x0a,
      0x25, // ef\n229\n%
      0x25,
      0x45,
      0x4f,
      0x46,
      0x0a, // %EOF\n
    ])
    return pdfBytes
  }

  // PDF読み込み・レンダリングテスト（Worker使用）
  const testPDFLoadingWithWorker = async () => {
    try {
      const testPDFBytes = createTestPDF()

      // PDF.jsでPDFを読み込み
      const pdf = await pdfjs.getDocument({
        data: testPDFBytes.buffer,
      }).promise

      setTestResults((prev) => ({
        ...prev,
        pdfLoaded: true,
      }))

      // 最初のページをレンダリング
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.0 })

      // Canvas要素を作成してレンダリング
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (context) {
        canvas.height = viewport.height
        canvas.width = viewport.width

        // ページをレンダリング
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        await page.render(renderContext).promise

        setTestResults((prev) => ({
          ...prev,
          pageRendered: true,
        }))

        console.log("PDF rendered successfully with Worker")
      }
    } catch (error) {
      console.error("PDF loading with worker failed:", error)
    }
  }

  // PDF読み込み・レンダリングテスト（Workerなし）
  const testPDFLoadingWithoutWorker = async () => {
    try {
      // 一時的にWorkerを無効にする
      const originalWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc
      pdfjs.GlobalWorkerOptions.workerSrc = ""

      const testPDFBytes = createTestPDF()

      const pdf = await pdfjs.getDocument({
        data: testPDFBytes.buffer,
      }).promise

      setTestResults((prev) => ({
        ...prev,
        workerlessTest: true,
      }))

      console.log("PDF loaded successfully without Worker")

      // Worker設定を復元
      pdfjs.GlobalWorkerOptions.workerSrc = originalWorkerSrc
    } catch (error) {
      console.error("PDF loading without worker failed:", error)

      // エラーが発生してもWorker設定を復元
      const originalWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc
      pdfjs.GlobalWorkerOptions.workerSrc = originalWorkerSrc
    }
  }

  // 全テスト実行
  const runAllTests = async () => {
    console.log("=== PDF.js Worker オフラインテスト開始 ===")

    // テスト結果をリセット
    setTestResults({
      workerInitialized: false,
      pdfLoaded: false,
      pageRendered: false,
      workerlessTest: false,
    })

    // 1. Worker初期化
    await initializeWorker()

    if (workerStatus === "ready") {
      // 2. Worker使用でのPDFテスト
      await testPDFLoadingWithWorker()

      // 3. Workerなしでのテスト
      await testPDFLoadingWithoutWorker()
    }

    console.log("=== テスト完了 ===")
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl space-y-6 px-4">
        <header className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            PDF.js Worker オフライン動作テスト
          </h1>
          <p className="mx-auto max-w-2xl text-gray-600">
            PDF.js Worker
            の初期化、PDF読み込み、レンダリング機能をオフライン環境でテストします。
          </p>
        </header>

        {/* 制御パネル */}
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">テスト制御</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={initializeWorker}
              className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              disabled={workerStatus === "loading"}
            >
              Worker初期化テスト
            </button>
            <button
              onClick={testPDFLoadingWithWorker}
              className="rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
              disabled={workerStatus !== "ready"}
            >
              PDF読み込みテスト（Worker使用）
            </button>
            <button
              onClick={testPDFLoadingWithoutWorker}
              className="rounded bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
            >
              PDF読み込みテスト（Workerなし）
            </button>
            <button
              onClick={runAllTests}
              className="rounded bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              全テスト実行
            </button>
          </div>
        </section>

        {/* テスト状況 */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">テスト結果</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 font-medium">Worker初期化</h3>
              <div
                className={`inline-block rounded-full px-3 py-1 text-sm ${
                  testResults.workerInitialized
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {testResults.workerInitialized ? "✓ 成功" : "未実行"}
              </div>
              {workerUrl && (
                <p className="mt-2 text-sm text-gray-600">
                  Worker URL: {workerUrl}
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 font-medium">PDF読み込み</h3>
              <div
                className={`inline-block rounded-full px-3 py-1 text-sm ${
                  testResults.pdfLoaded
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {testResults.pdfLoaded ? "✓ 成功" : "未実行"}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 font-medium">ページレンダリング</h3>
              <div
                className={`inline-block rounded-full px-3 py-1 text-sm ${
                  testResults.pageRendered
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {testResults.pageRendered ? "✓ 成功" : "未実行"}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 font-medium">Workerなしテスト</h3>
              <div
                className={`inline-block rounded-full px-3 py-1 text-sm ${
                  testResults.workerlessTest
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {testResults.workerlessTest ? "✓ 成功" : "未実行"}
              </div>
            </div>
          </div>
        </section>

        {/* 技術詳細 */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">技術詳細</h2>
          <div className="space-y-3 rounded-lg border bg-white p-4">
            <div>
              <strong>PDF.js バージョン:</strong> {"Unknown"}
            </div>
            <div>
              <strong>Worker状況:</strong>
              <span
                className={`ml-2 rounded px-2 py-1 text-sm ${
                  workerStatus === "ready"
                    ? "bg-green-100 text-green-800"
                    : workerStatus === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {workerStatus === "ready"
                  ? "準備完了"
                  : workerStatus === "error"
                    ? "エラー"
                    : "読み込み中"}
              </span>
            </div>
            <div>
              <strong>現在のWorker URL:</strong>
              <span className="ml-2 font-mono text-sm">
                {workerUrl || "なし"}
              </span>
            </div>
          </div>
        </section>

        {/* 説明 */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">テスト説明</h2>
          <div className="space-y-4 rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-medium">1. Worker初期化テスト</h3>
              <p className="text-sm text-gray-600">
                ローカルのPDF.js
                Workerファイル（/js/pdf.worker.min.mjs）の存在確認と初期化
              </p>
            </div>
            <div>
              <h3 className="font-medium">
                2. PDF読み込みテスト（Worker使用）
              </h3>
              <p className="text-sm text-gray-600">
                Workerを使用してテスト用PDFファイルの読み込みと最初のページのレンダリング
              </p>
            </div>
            <div>
              <h3 className="font-medium">
                3. PDF読み込みテスト（Workerなし）
              </h3>
              <p className="text-sm text-gray-600">
                Workerを無効にしてメインスレッドでのPDF読み込み（フォールバック動作確認）
              </p>
            </div>
          </div>
        </section>

        {/* デバッグ情報 */}
        <section>
          <details className="rounded-lg border bg-white">
            <summary className="cursor-pointer p-4 font-medium">
              デバッグ情報（開発者向け）
            </summary>
            <div className="space-y-2 border-t px-4 pb-4">
              <div>
                <strong>ユーザーエージェント:</strong>
                <p className="rounded bg-gray-100 p-2 font-mono text-sm">
                  {typeof navigator !== "undefined"
                    ? navigator.userAgent
                    : "N/A"}
                </p>
              </div>
              <div>
                <strong>現在のURL:</strong>
                <p className="rounded bg-gray-100 p-2 font-mono text-sm">
                  {typeof window !== "undefined" ? window.location.href : "N/A"}
                </p>
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  )
}
