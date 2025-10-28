/* eslint-disable @next/next/no-img-element */
"use client"

import { convertTextToSvg } from "@/app/textbox-on-canvas-v3/utils/textConversionUtils"
import { useCallback, useEffect, useState } from "react"
import { renderMarkdownToCanvasV3 } from "./utils/canvasTextRendererV3"

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
    errors: [],
  })

  const testText = `
**太字テスト** と *斜体テスト*
改行処理テスト
数式テスト: $x^2 + y^2 = r^2$
ブロック数式:
$$\\int_{0}^{\\infty} e^{-x} dx = 1$$
LaTeX記法: \\(\\alpha + \\beta\\) と \\[\\gamma = \\frac{a}{b}\\]
`

  const runIntegrationTest = useCallback(async () => {
    const errors: string[] = []

    try {
      // テスト1: textbox-on-canvas-v3の直接使用
      console.log("🧪 テスト1: textbox-on-canvas-v3 直接使用")
      const svgElement = await convertTextToSvg(
        testText.trim(),
        400, // width
        300, // height
        "left", // horizontalAlign
        "top", // verticalAlign
      )

      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
        setTestResults((prev) => ({ ...prev, directSvg: svgDataUrl }))
        console.log("✅ テスト1成功: textbox-on-canvas-v3直接使用")
      } else {
        errors.push("テスト1失敗: textbox-on-canvas-v3がnullを返した")
      }

      // テスト2: canvasTextRendererV3経由の使用
      console.log("🧪 テスト2: canvasTextRendererV3経由使用")
      const canvasResult = await renderMarkdownToCanvasV3({
        text: testText.trim(),
        color: "#000000",
        fontSize: 16,
        maxWidth: 400,
        maxHeight: 300,
        backgroundColor: "transparent",
      })

      if (canvasResult.canvas && canvasResult.canvas.width > 0) {
        const canvasDataUrl = canvasResult.canvas.toDataURL()
        setTestResults((prev) => ({ ...prev, canvasRender: canvasDataUrl }))
        console.log("✅ テスト2成功: canvasTextRendererV3経由", {
          dimensions: canvasResult.dimensions,
        })
      } else {
        errors.push("テスト2失敗: Canvas生成に問題")
      }
    } catch (error) {
      console.error("❌ 統合テストエラー:", error)
      errors.push(
        `統合テストエラー: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }

    setTestResults((prev) => ({ ...prev, errors }))
  }, [testText])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      runIntegrationTest()
    })

    return () => cancelAnimationFrame(frame)
  }, [runIntegrationTest])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="rounded-lg border bg-blue-50 p-4">
        <h2 className="mb-2 text-lg font-bold text-blue-800">
          🧪 textbox-on-canvas-v3 統合テスト
        </h2>
        <p className="text-sm text-blue-700">
          採点画面での完全統合機能をテストします
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* テスト結果1: 直接使用 */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-semibold text-green-700">
            ✅ テスト1: textbox-on-canvas-v3直接使用
          </h3>
          <div className="flex min-h-[200px] items-center justify-center rounded border border-gray-200 bg-white p-3">
            {testResults.directSvg ? (
              <img
                src={testResults.directSvg}
                alt="Direct V3 SVG Test"
                className="h-auto max-w-full"
              />
            ) : (
              <div className="text-gray-400">SVG生成中...</div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            scrollWidth/scrollHeight測定 + 改行処理(\n分割)
          </div>
        </div>

        {/* テスト結果2: Canvas経由 */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-semibold text-green-700">
            ✅ テスト2: canvasTextRendererV3経由
          </h3>
          <div className="flex min-h-[200px] items-center justify-center rounded border border-gray-200 bg-white p-3">
            {testResults.canvasRender ? (
              <img
                src={testResults.canvasRender}
                alt="Canvas V3 Render Test"
                className="h-auto max-w-full"
              />
            ) : (
              <div className="text-gray-400">Canvas描画中...</div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            V3統合版Canvas描画 + アスペクト比維持
          </div>
        </div>
      </div>

      {/* テストテキスト */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <h3 className="mb-2 font-semibold">📝 テストテキスト</h3>
        <pre className="rounded border bg-white p-3 text-sm whitespace-pre-wrap text-gray-700">
          {testText}
        </pre>
      </div>

      {/* エラー表示 */}
      {testResults.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-700">❌ エラー</h3>
          <ul className="space-y-1 text-sm text-red-600">
            {testResults.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 期待される結果 */}
      <div className="rounded-lg border bg-green-50 p-4">
        <h3 className="mb-2 font-semibold text-green-700">
          ✅ 期待される統合結果
        </h3>
        <ul className="space-y-1 text-sm text-green-700">
          <li>
            • <strong>scrollWidth/scrollHeight測定</strong>:
            正確な寸法でのテキスト表示
          </li>
          <li>
            • <strong>改行処理の最適化</strong>: \n分割による単一行ごとの処理
          </li>
          <li>
            • <strong>MathJax即時反映</strong>: 数式の高品質レンダリング
          </li>
          <li>
            • <strong>LaTeX記法サポート</strong>: \( \) と \[ \] 記法の自動変換
          </li>
          <li>
            • <strong>統合品質</strong>: 両方のテストで同等の高品質な結果
          </li>
        </ul>
      </div>
    </div>
  )
}
