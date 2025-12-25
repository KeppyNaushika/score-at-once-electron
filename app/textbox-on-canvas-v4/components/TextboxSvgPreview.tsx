/**
 * @fileoverview SVGプレビューコンポーネント
 * @description 変換後の純粋なSVG図形データを表示
 */

"use client"

import { useEffect, useState } from "react"
import type { TextBox } from "../types"
import { convertTextToSvg } from "../utils/textConversionUtils"

/**
 * SVG プレビューコンポーネント
 * 変換後の純粋なSVG図形データを表示
 */
export function TextboxSvgPreview({ textBox }: { textBox: TextBox }) {
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")

  useEffect(() => {
    if (textBox.text.trim()) {
      let isCancelled = false

      const renderSvgPreview = async () => {
        try {
          setRenderingStatus("SVG生成中...")

          // アンカーベースのSVG生成処理
          const estimatedWidth = textBox.text.length * textBox.textSize * 0.6
          const estimatedHeight = textBox.textSize * 1.2

          const generatedSvg = await convertTextToSvg(
            textBox.text,
            estimatedWidth,
            estimatedHeight,
            "left",
            "top",
            textBox.textSize,
          )

          // コンポーネントがアンマウントされている場合は処理を中止
          if (isCancelled) return

          if (generatedSvg) {
            setSvgElement(generatedSvg.cloneNode(true) as SVGSVGElement)
            setRenderingStatus("SVG生成完了")
          } else {
            setSvgElement(null)
            setRenderingStatus("SVG生成失敗")
          }
        } catch (error) {
          if (!isCancelled) {
            // SVGプレビュー処理エラー
            setSvgElement(null)
            setRenderingStatus("SVG生成エラー")
          }
        }
      }

      renderSvgPreview()

      // クリーンアップ関数
      return () => {
        isCancelled = true
      }
    } else {
      let cancelled = false
      const frame = requestAnimationFrame(() => {
        if (cancelled) {
          return
        }
        setSvgElement(null)
        setRenderingStatus("待機中")
      })

      return () => {
        cancelled = true
        cancelAnimationFrame(frame)
      }
    }
  }, [textBox.text, textBox.textSize])

  return (
    <div className="rounded border border-blue-300 bg-white p-2">
      <div className="mb-1 text-xs text-gray-500">
        ID: {textBox.id.substring(0, 8)}... | SVGサイズ:{" "}
        {svgElement?.getAttribute("width") || "N/A"} ×{" "}
        {svgElement?.getAttribute("height") || "N/A"}
      </div>
      <div className="flex min-h-[60px] items-center justify-center rounded border border-gray-200 bg-white p-2">
        {svgElement ? (
          <div
            dangerouslySetInnerHTML={{
              __html: new XMLSerializer().serializeToString(svgElement),
            }}
            style={{ maxWidth: "100%", overflow: "auto" }}
          />
        ) : (
          <div className="text-sm text-gray-400">SVG生成待機中...</div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>ステータス: {renderingStatus}</span>
        <span>元テキスト長: {textBox.text.length}文字</span>
      </div>
    </div>
  )
}
