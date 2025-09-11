/**
 * @fileoverview DIVプレビューコンポーネント
 * @description MathJax処理を含むテキストボックスのDIVベースプレビュー表示
 */

"use client"

import { useEffect, useRef } from "react"
import type { TextBox } from "../types"
import {
  parseTextWithMath,
  processMathJaxContent,
} from "../utils/textConversionUtils"

/**
 * TextboxのプレビューコンポーネントでMathJax処理を実行
 * SVG変換と完全に同じロジックを使用
 */
export function TextboxPreview({ textBox }: { textBox: TextBox }) {
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (previewRef.current && textBox.text) {
      const processPreview = async () => {
        try {
          // テキストをHTMLに変換
          const htmlContent = parseTextWithMath(textBox.text)

          // SVG変換と完全に同じMathJax処理を実行
          await processMathJaxContent(previewRef.current!, htmlContent)
        } catch (error) {
          console.error("DIVプレビュー処理エラー:", error)
        }
      }

      processPreview()
    }
  }, [textBox.text])

  return (
    <div className="rounded border border-green-300 bg-white p-2">
      <div className="mb-1 text-xs text-gray-500">
        ID: {textBox.id.substring(0, 8)}... | 位置: ({Math.round(textBox.x)},{" "}
        {Math.round(textBox.y)})
      </div>
      <div ref={previewRef} className="math-preview text-sm" />
      <div className="mt-1 text-xs text-gray-400">
        生テキスト: {textBox.text}
      </div>
    </div>
  )
}
