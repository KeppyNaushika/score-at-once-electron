/**
 * @fileoverview SVGプレビューコンポーネント
 * @description 変換後の純粋なSVG図形データを表示
 */

"use client"

import React, { useEffect, useState } from "react"
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
    if (textBox.text) {
      const renderSvgPreview = async () => {
        try {
          setRenderingStatus("SVG生成中...")
          
          // Canvas描画プレビューと**全く同じSVG生成処理**
          const generatedSvg = await convertTextToSvg(
            textBox.text, 
            textBox.width, 
            textBox.height, 
            textBox.horizontalAlign || 'left', 
            textBox.verticalAlign || 'top'
          )

          if (generatedSvg) {
            setSvgElement(generatedSvg.cloneNode(true) as SVGSVGElement)
            setRenderingStatus("SVG生成完了")
          } else {
            setSvgElement(null)
            setRenderingStatus("SVG生成失敗")
          }

        } catch (error) {
          console.error("SVGプレビュー処理エラー:", error)
          setSvgElement(null)
          setRenderingStatus("SVG生成エラー")
        }
      }

      renderSvgPreview()
    }
  }, [textBox.text, textBox.width, textBox.height, textBox.horizontalAlign, textBox.verticalAlign])

  return (
    <div className="border border-blue-300 rounded p-2 bg-white">
      <div className="text-xs text-gray-500 mb-1">
        ID: {textBox.id.substring(0, 8)}... | SVGサイズ: {svgElement?.getAttribute('width') || 'N/A'} × {svgElement?.getAttribute('height') || 'N/A'}
      </div>
      <div className="border border-gray-200 rounded p-2 bg-white min-h-[60px] flex items-center justify-center">
        {svgElement ? (
          <div 
            dangerouslySetInnerHTML={{ 
              __html: new XMLSerializer().serializeToString(svgElement) 
            }}
            style={{ maxWidth: '100%', overflow: 'auto' }}
          />
        ) : (
          <div className="text-gray-400 text-sm">SVG生成待機中...</div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>ステータス: {renderingStatus}</span>
        <span>元テキスト長: {textBox.text.length}文字</span>
      </div>
    </div>
  )
}