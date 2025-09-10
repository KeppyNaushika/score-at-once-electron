"use client"

import React, { useState, useEffect } from 'react'
import { convertTextToSvg } from '@/app/textbox-on-canvas-v3/utils/textConversionUtils'
import { renderMarkdownToCanvasV3 } from './utils/canvasTextRendererV3'

/**
 * V3統合テストコンポーネント
 * textbox-on-canvas-v3の機能が採点画面で正常動作するかテスト
 */
export default function V3IntegrationTest() {
  const [testResults, setTestResults] = useState<{
    directSvg: string | null
    canvasRender: string | null
    errors: string[]
  }>({
    directSvg: null,
    canvasRender: null,
    errors: []
  })

  const testText = `
**太字テスト** と *斜体テスト*
改行処理テスト
数式テスト: $x^2 + y^2 = r^2$
ブロック数式:
$$\\int_{0}^{\\infty} e^{-x} dx = 1$$
LaTeX記法: \\(\\alpha + \\beta\\) と \\[\\gamma = \\frac{a}{b}\\]
`

  const runIntegrationTest = async () => {
    const errors: string[] = []
    
    try {
      // テスト1: textbox-on-canvas-v3の直接使用
      console.log('🧪 テスト1: textbox-on-canvas-v3 直接使用')
      const svgElement = await convertTextToSvg(
        testText.trim(),
        400, // width
        300, // height
        'left', // horizontalAlign
        'top' // verticalAlign
      )
      
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
        setTestResults(prev => ({ ...prev, directSvg: svgDataUrl }))
        console.log('✅ テスト1成功: textbox-on-canvas-v3直接使用')
      } else {
        errors.push('テスト1失敗: textbox-on-canvas-v3がnullを返した')
      }

      // テスト2: canvasTextRendererV3経由の使用
      console.log('🧪 テスト2: canvasTextRendererV3経由使用')
      const canvasResult = await renderMarkdownToCanvasV3({
        text: testText.trim(),
        color: '#000000',
        fontSize: 16,
        maxWidth: 400,
        maxHeight: 300,
        backgroundColor: 'transparent'
      })
      
      if (canvasResult.canvas && canvasResult.canvas.width > 0) {
        const canvasDataUrl = canvasResult.canvas.toDataURL()
        setTestResults(prev => ({ ...prev, canvasRender: canvasDataUrl }))
        console.log('✅ テスト2成功: canvasTextRendererV3経由', {
          dimensions: canvasResult.dimensions
        })
      } else {
        errors.push('テスト2失敗: Canvas生成に問題')
      }

    } catch (error) {
      console.error('❌ 統合テストエラー:', error)
      errors.push(`統合テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    setTestResults(prev => ({ ...prev, errors }))
  }

  useEffect(() => {
    runIntegrationTest()
  }, [])

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div className="bg-blue-50 p-4 rounded-lg border">
        <h2 className="text-lg font-bold text-blue-800 mb-2">
          🧪 textbox-on-canvas-v3 統合テスト
        </h2>
        <p className="text-blue-700 text-sm">
          採点画面での完全統合機能をテストします
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* テスト結果1: 直接使用 */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-green-700">
            ✅ テスト1: textbox-on-canvas-v3直接使用
          </h3>
          <div className="bg-white border border-gray-200 rounded p-3 min-h-[200px] flex items-center justify-center">
            {testResults.directSvg ? (
              <img 
                src={testResults.directSvg} 
                alt="Direct V3 SVG Test" 
                className="max-w-full h-auto"
              />
            ) : (
              <div className="text-gray-400">SVG生成中...</div>
            )}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            scrollWidth/scrollHeight測定 + 改行処理(\n分割)
          </div>
        </div>

        {/* テスト結果2: Canvas経由 */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-green-700">
            ✅ テスト2: canvasTextRendererV3経由
          </h3>
          <div className="bg-white border border-gray-200 rounded p-3 min-h-[200px] flex items-center justify-center">
            {testResults.canvasRender ? (
              <img 
                src={testResults.canvasRender} 
                alt="Canvas V3 Render Test" 
                className="max-w-full h-auto"
              />
            ) : (
              <div className="text-gray-400">Canvas描画中...</div>
            )}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            V3統合版Canvas描画 + アスペクト比維持
          </div>
        </div>
      </div>

      {/* テストテキスト */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold mb-2">📝 テストテキスト</h3>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border">
          {testText}
        </pre>
      </div>

      {/* エラー表示 */}
      {testResults.errors.length > 0 && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h3 className="font-semibold mb-2 text-red-700">❌ エラー</h3>
          <ul className="text-sm text-red-600 space-y-1">
            {testResults.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 期待される結果 */}
      <div className="border rounded-lg p-4 bg-green-50">
        <h3 className="font-semibold mb-2 text-green-700">✅ 期待される統合結果</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• <strong>scrollWidth/scrollHeight測定</strong>: 正確な寸法でのテキスト表示</li>
          <li>• <strong>改行処理の最適化</strong>: \n分割による単一行ごとの処理</li>
          <li>• <strong>MathJax即時反映</strong>: 数式の高品質レンダリング</li>
          <li>• <strong>LaTeX記法サポート</strong>: \( \) と \[ \] 記法の自動変換</li>
          <li>• <strong>統合品質</strong>: 両方のテストで同等の高品質な結果</li>
        </ul>
      </div>
    </div>
  )
}