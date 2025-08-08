"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeMathjax from "rehype-mathjax/svg"

export default function TestRehypeMathjaxOnCanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markdownPreviewRef = useRef<HTMLDivElement>(null)
  const [markdownText, setMarkdownText] = useState(
    "文字 b b b $b$ $\\dfrac{3}{2}b$ のベースライン検証",
  )
  const [status, setStatus] = useState("")
  const [isMounted, setIsMounted] = useState(false)

  // プレビュー全体をSVGに変換
  const convertPreviewToSvg =
    useCallback(async (): Promise<SVGSVGElement | null> => {
      const previewDiv = markdownPreviewRef.current
      if (!previewDiv) {
        return null
      }

      try {
        const rect = previewDiv.getBoundingClientRect()
        const width = Math.max(rect.width, 800)
        const height = Math.max(rect.height, 400)

        const htmlContent = previewDiv.innerHTML

        const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <foreignObject x="0" y="0" width="${width}" height="${height}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="padding: 20px; background: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', Arial, sans-serif; font-size: 24px; line-height: 1.5; color: #000000;">
              ${htmlContent}
            </div>
          </foreignObject>
        </svg>
      `

        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml")
        const svgElement = svgDoc.documentElement as unknown as SVGSVGElement


        return svgElement
      } catch (error) {
        console.error("❌ SVG変換エラー:", error)
        return null
      }
    }, [])

  // SVG全体をCanvasに描画する関数
  const renderSvgToCanvas = useCallback(
    async (
      svgElement: SVGSVGElement,
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
    ): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        try {
          const svgData = new XMLSerializer().serializeToString(svgElement)
          const svgBlob = new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8",
          })
          const svgUrl = URL.createObjectURL(svgBlob)

          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, x, y)
            URL.revokeObjectURL(svgUrl)
            resolve({ width: img.width, height: img.height })
          }

          img.onerror = () => {
            URL.revokeObjectURL(svgUrl)
            resolve({ width: 0, height: 0 })
          }

          img.src = svgUrl
        } catch (error) {
          console.error("SVG描画エラー:", error)
          resolve({ width: 0, height: 0 })
        }
      })
    },
    [],
  )

  // プレビュー全体をCanvasに描画
  const renderPreviewToCanvas = useCallback(async () => {
    if (typeof window === "undefined") return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setStatus("描画中...")

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const wholeSvg = await convertPreviewToSvg()
      if (!wholeSvg) {
        setStatus("⚠️ プレビューのSVG変換に失敗しました")
        return
      }

      const result = await renderSvgToCanvas(wholeSvg, ctx, 0, 0)
      setStatus(`描画完了: ${result.width}x${result.height}px`)
    } catch (error) {
      setStatus(`❌ Canvas描画エラー: ${error}`)
      console.error("Canvas描画エラー:", error)
    }
  }, [convertPreviewToSvg, renderSvgToCanvas])

  // メイン描画関数
  const handleRender = useCallback(async () => {
    if (!markdownText.trim()) return

    await new Promise((resolve) => setTimeout(resolve, 500))
    await renderPreviewToCanvas()
  }, [markdownText, renderPreviewToCanvas])

  // マウント時の初期化
  useEffect(() => {
    setIsMounted(true)
    if (markdownText) {
      handleRender()
    }
  }, [markdownText, handleRender])

  const testCases = [
    "文字 b b b $b$ $\\dfrac{3}{2}b$ のベースライン検証",
    "分数テスト: $\\dfrac{1}{2}$ と $\\dfrac{3}{4}$ と $\\dfrac{a}{b}$",
    "積分: $\\int_0^1 x^2 dx = \\dfrac{1}{3}$ の表示",
    "連続分数: $\\dfrac{1}{2}$ $\\dfrac{2}{3}$ $\\dfrac{3}{4}$ の列",
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          Rehype-MathJax 統合Canvas描画テスト
        </h1>
        <p className="text-gray-600">
          プレビュー全体をSVGに変換してCanvas描画し、自然なベースライン揃えを検証します
        </p>
      </div>

      {/* 入力エリア */}
      <Card>
        <CardHeader>
          <CardTitle>Markdown入力 (rehype-mathjax処理)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder="Markdown記法で数式を入力してください..."
            rows={3}
            className="font-mono"
          />

          <Button onClick={handleRender} className="w-full">
            プレビュー全体 → Canvas描画
          </Button>

          <div className="grid grid-cols-2 gap-2">
            {testCases.map((testCase, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setMarkdownText(testCase)
                }}
                className="justify-start text-left font-mono text-xs"
              >
                {isMounted
                  ? testCase.length > 30
                    ? testCase.substring(0, 30) + "..."
                    : testCase
                  : `テストケース${index + 1}`}
              </Button>
            ))}
          </div>

          {status && (
            <div className="rounded-md bg-gray-100 p-2">
              <p className="text-sm">{status}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ReactMarkdown プレビュー */}
      <Card>
        <CardHeader>
          <CardTitle>ReactMarkdown プレビュー (SVG変換元)</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={markdownPreviewRef}
            className="max-w-none rounded-md border bg-white p-4"
            style={{
              fontSize: "24px",
              lineHeight: 1.5,
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeMathjax]}
            >
              {markdownText}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Canvas描画結果 */}
      <Card>
        <CardHeader>
          <CardTitle>Canvas描画結果（プレビュー全体を統合描画）</CardTitle>
        </CardHeader>
        <CardContent>
          <canvas
            ref={canvasRef}
            width={1000}
            height={400}
            className="w-full border border-gray-300 bg-white"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
