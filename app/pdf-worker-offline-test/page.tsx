'use client'

import { useState } from 'react'
import * as pdfjs from 'pdfjs-dist'

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
export default function PDFWorkerOfflineTestPage() {
  const [workerStatus, setWorkerStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [workerUrl, setWorkerUrl] = useState<string>('')
  const [testResults, setTestResults] = useState<{
    workerInitialized: boolean
    pdfLoaded: boolean
    renderingTest: boolean
    workerlessTest: boolean
    errorMessages: string[]
  }>({
    workerInitialized: false,
    pdfLoaded: false,
    renderingTest: false,
    workerlessTest: false,
    errorMessages: []
  })
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null)

  // PDF.js Worker初期化テスト
  const testWorkerInitialization = async () => {
    try {
      // 現在のWorker設定確認
      const currentWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc
      setWorkerUrl(currentWorkerSrc || 'Not Set')

      // Worker URLが正しく設定されているかテスト
      if (currentWorkerSrc.includes('/js/pdf.worker.min.mjs')) {
        setTestResults(prev => ({ 
          ...prev, 
          workerInitialized: true 
        }))
        setWorkerStatus('ready')
        
        // Worker URLが実際にアクセス可能かテスト
        try {
          const response = await fetch(currentWorkerSrc)
          if (response.ok) {
            console.log('✅ PDF Worker file accessible')
          } else {
            throw new Error(`Worker file not accessible: ${response.status}`)
          }
        } catch (error) {
          setTestResults(prev => ({ 
            ...prev, 
            errorMessages: [...prev.errorMessages, `Worker file access error: ${error}`]
          }))
        }
      } else {
        throw new Error('Worker path not set to local file')
      }
    } catch (error) {
      setWorkerStatus('error')
      setTestResults(prev => ({ 
        ...prev, 
        errorMessages: [...prev.errorMessages, `Worker initialization error: ${error}`]
      }))
    }
  }

  // 簡単なPDFを生成してテスト
  const createTestPDF = () => {
    // 最小限のPDFバイト列（"Hello PDF"を含む1ページのPDF）
    const pdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
      0x0A, 0x31, 0x20, 0x30, 0x20, 0x6F, 0x62, 0x6A, // \n1 0 obj
      0x0A, 0x3C, 0x3C, 0x2F, 0x54, 0x79, 0x70, 0x65, // \n<</Type
      0x2F, 0x43, 0x61, 0x74, 0x61, 0x6C, 0x6F, 0x67, // /Catalog
      0x2F, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20, 0x32, // /Pages 2
      0x20, 0x30, 0x20, 0x52, 0x3E, 0x3E, 0x0A, 0x65, //  0 R>>\ne
      0x6E, 0x64, 0x6F, 0x62, 0x6A, 0x0A, 0x32, 0x20, // ndobj\n2 
      0x30, 0x20, 0x6F, 0x62, 0x6A, 0x0A, 0x3C, 0x3C, // 0 obj\n<<
      0x2F, 0x54, 0x79, 0x70, 0x65, 0x2F, 0x50, 0x61, // /Type/Pa
      0x67, 0x65, 0x73, 0x2F, 0x4B, 0x69, 0x64, 0x73, // ges/Kids
      0x5B, 0x33, 0x20, 0x30, 0x20, 0x52, 0x5D, 0x2F, // [3 0 R]/
      0x43, 0x6F, 0x75, 0x6E, 0x74, 0x20, 0x31, 0x3E, // Count 1>
      0x3E, 0x0A, 0x65, 0x6E, 0x64, 0x6F, 0x62, 0x6A, // >\nendobj
      0x0A, 0x33, 0x20, 0x30, 0x20, 0x6F, 0x62, 0x6A, // \n3 0 obj
      0x0A, 0x3C, 0x3C, 0x2F, 0x54, 0x79, 0x70, 0x65, // \n<</Type
      0x2F, 0x50, 0x61, 0x67, 0x65, 0x2F, 0x50, 0x61, // /Page/Pa
      0x72, 0x65, 0x6E, 0x74, 0x20, 0x32, 0x20, 0x30, // rent 2 0
      0x20, 0x52, 0x2F, 0x4D, 0x65, 0x64, 0x69, 0x61, //  R/Media
      0x42, 0x6F, 0x78, 0x5B, 0x30, 0x20, 0x30, 0x20, // Box[0 0 
      0x36, 0x31, 0x32, 0x20, 0x37, 0x39, 0x32, 0x5D, // 612 792]
      0x3E, 0x3E, 0x0A, 0x65, 0x6E, 0x64, 0x6F, 0x62, // >>\nendob
      0x6A, 0x0A, 0x78, 0x72, 0x65, 0x66, 0x0A, 0x30, // j\nxref\n0
      0x20, 0x34, 0x0A, 0x30, 0x30, 0x30, 0x30, 0x30, //  4\n00000
      0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x36, 0x35, // 00000 65
      0x35, 0x33, 0x35, 0x20, 0x66, 0x20, 0x0A, 0x30, // 535 f \n0
      0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, // 00000000
      0x39, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, // 9 00000 
      0x6E, 0x20, 0x0A, 0x30, 0x30, 0x30, 0x30, 0x30, // n \n00000
      0x30, 0x30, 0x30, 0x37, 0x34, 0x20, 0x30, 0x30, // 00074 00
      0x30, 0x30, 0x30, 0x20, 0x6E, 0x20, 0x0A, 0x30, // 000 n \n0
      0x30, 0x30, 0x30, 0x30, 0x30, 0x31, 0x34, 0x31, // 0000141
      0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6E, //  00000 n
      0x20, 0x0A, 0x74, 0x72, 0x61, 0x69, 0x6C, 0x65, //  \ntraile
      0x72, 0x0A, 0x3C, 0x3C, 0x2F, 0x53, 0x69, 0x7A, // r\n<</Siz
      0x65, 0x20, 0x34, 0x2F, 0x52, 0x6F, 0x6F, 0x74, // e 4/Root
      0x20, 0x31, 0x20, 0x30, 0x20, 0x52, 0x3E, 0x3E, //  1 0 R>>
      0x0A, 0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, // \nstartxr
      0x65, 0x66, 0x0A, 0x32, 0x32, 0x39, 0x0A, 0x25, // ef\n229\n%
      0x25, 0x45, 0x4F, 0x46, 0x0A                    // %EOF\n
    ])
    return pdfBytes
  }

  // PDF読み込み・レンダリングテスト（Worker使用）
  const testPDFLoadingWithWorker = async () => {
    try {
      const testPDFBytes = createTestPDF()
      
      // PDF.jsでPDFを読み込み
      const pdf = await pdfjs.getDocument({
        data: testPDFBytes,
        useWorkerFetch: true, // Workerを使用
      }).promise

      setTestResults(prev => ({ 
        ...prev, 
        pdfLoaded: true 
      }))

      // 最初のページをレンダリング
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.0 })

      if (canvasRef) {
        const context = canvasRef.getContext('2d')!
        canvasRef.height = viewport.height
        canvasRef.width = viewport.width

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise

        setTestResults(prev => ({ 
          ...prev, 
          renderingTest: true 
        }))
      }

    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        errorMessages: [...prev.errorMessages, `PDF loading error: ${error}`]
      }))
    }
  }

  // Worker無しでのテスト（比較用）
  const testWithoutWorker = async () => {
    try {
      // 一時的にWorkerを無効化
      const originalWorkerSrc = pdfjs.GlobalWorkerOptions.workerSrc
      pdfjs.GlobalWorkerOptions.workerSrc = ''

      const testPDFBytes = createTestPDF()
      
      const pdf = await pdfjs.getDocument({
        data: testPDFBytes,
        useWorkerFetch: false,
      }).promise

      setTestResults(prev => ({ 
        ...prev, 
        workerlessTest: true 
      }))

      // Worker設定を復元
      pdfjs.GlobalWorkerOptions.workerSrc = originalWorkerSrc

    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        errorMessages: [...prev.errorMessages, `Workerless test error: ${error}`]
      }))
    }
  }

  // 全テストを実行
  const runAllTests = async () => {
    setTestResults({
      workerInitialized: false,
      pdfLoaded: false,
      renderingTest: false,
      workerlessTest: false,
      errorMessages: []
    })

    await testWorkerInitialization()
    await testPDFLoadingWithWorker()
    await testWithoutWorker()
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">PDF.js Worker オフライン動作テスト</h1>
        
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">動作状況</h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${testResults.workerInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>PDF Worker初期化: {testResults.workerInitialized ? '✅ 完了' : '❌ 未完了'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${testResults.pdfLoaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>PDF読み込み: {testResults.pdfLoaded ? '✅ 成功' : '❌ 失敗'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${testResults.renderingTest ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>レンダリング: {testResults.renderingTest ? '✅ 成功' : '❌ 失敗'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${testResults.workerlessTest ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span>Worker無しテスト: {testResults.workerlessTest ? '✅ 成功' : '⏳ 未実行'}</span>
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Worker URL: <code className="bg-gray-200 p-1 rounded text-xs">{workerUrl || 'Loading...'}</code>
            </p>
          </div>

          <button 
            onClick={runAllTests}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            全テスト実行
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">テスト結果表示</h2>
          <div className="bg-white p-4 border rounded-lg">
            <canvas 
              ref={setCanvasRef}
              className="max-w-full border"
              style={{ maxHeight: '300px' }}
            />
            {!testResults.renderingTest && (
              <p className="text-gray-500 text-center py-8">テストPDFがここに表示されます</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">技術詳細</h2>
          <div className="bg-white p-4 border rounded-lg space-y-3">
            <div>
              <strong>PDF.js バージョン:</strong> {pdfjs.version || 'Unknown'}
            </div>
            <div>
              <strong>Worker状況:</strong> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                workerStatus === 'ready' ? 'bg-green-100 text-green-800' :
                workerStatus === 'error' ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
              }`}>
                {workerStatus === 'ready' ? 'Ready' : workerStatus === 'error' ? 'Error' : 'Loading'}
              </span>
            </div>
            <div>
              <strong>Worker URL:</strong> 
              <code className="block mt-1 text-xs bg-gray-100 p-2 rounded break-all">
                {workerUrl || 'Not loaded'}
              </code>
            </div>
            <div>
              <strong>テスト概要:</strong>
              <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                <li>ローカルWorkerファイルの存在確認</li>
                <li>小さなテストPDFの生成と読み込み</li>
                <li>Canvas上でのPDFレンダリング</li>
                <li>Worker有り/無しでの動作比較</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {testResults.errorMessages.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-3 text-red-600">エラーログ</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            {testResults.errorMessages.map((error, index) => (
              <div key={index} className="text-red-700 text-sm mb-2 font-mono">
                {error}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 p-4 bg-blue-50 border-l-4 border-blue-500">
        <h3 className="text-lg font-semibold">オフライン動作について</h3>
        <p className="mt-2">
          このテストが成功すれば、PDF.js Workerは完全にオフライン環境で動作します。
          Worker URLがローカル（<code>/js/pdf.worker.min.mjs</code>）を指していることで、
          ネットワーク接続なしでPDF処理が可能になります。
        </p>
        <div className="mt-3 text-sm">
          <p><strong>✅ 完全オフライン:</strong> すべてのテストが成功</p>
          <p><strong>⚠️ 部分オフライン:</strong> Worker無しでも動作（性能低下）</p>
          <p><strong>❌ オフライン不可:</strong> 外部依存が検出された</p>
        </div>
      </div>
    </div>
  )
}