/**
 * @fileoverview Imageプレビューコンポーネント
 * @description SVG→Image変換後の状態を表示
 */

"use client"

import { useEffect, useState } from "react"
import type { TextBox } from "../types"
import { convertTextToSvg } from "../utils/textConversionUtils"

/**
 * Image プレビューコンポーネント
 * SVG→Image変換後の状態を表示
 */
export function TextboxImagePreview({ textBox }: { textBox: TextBox }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [renderingStatus, setRenderingStatus] = useState<string>("待機中")

  useEffect(() => {
    if (textBox.text) {
      const renderImagePreview = async () => {
        try {
          setRenderingStatus("Image生成中...")

          // SVGプレビューと**全く同じSVG生成処理**
          const svgElement = await convertTextToSvg(
            textBox.text,
            textBox.width,
            textBox.height,
            textBox.horizontalAlign || "left",
            textBox.verticalAlign || "top",
          )

          if (svgElement) {
            // SVG→Blob→Image変換 (Canvas描画と全く同じ処理)
            let svgData = new XMLSerializer().serializeToString(svgElement)

            // MathJax要素が含まれている場合は、グローバルdefsを強制追加
            const hasMathJaxElements =
              svgData.includes("mjx-container") || svgData.includes("<use")
            if (hasMathJaxElements) {
              console.log("🔍 MathJax要素検出：グローバルdefsを追加")

              // ページ全体からMathJax defsを取得
              const globalDefs = document.querySelector(
                "#MJX-SVG-global-cache defs",
              )
              if (globalDefs && globalDefs.innerHTML.length > 10) {
                const defsContent = globalDefs.outerHTML
                console.log(`📦 グローバルdefs取得: ${defsContent.length}文字`)

                // SVGの開始タグ直後にdefsを強制挿入
                svgData = svgData.replace(/(<svg[^>]*>)/, `$1${defsContent}`)
                console.log("✅ グローバルdefs挿入完了")
              } else {
                console.warn("⚠️ グローバルdefsが見つかりません")
              }
            }

            const svgBlob = new Blob([svgData], {
              type: "image/svg+xml;charset=utf-8",
            })
            const svgUrl = URL.createObjectURL(svgBlob)

            const img = new Image()
            img.onload = () => {
              setImageUrl(svgUrl)
              setImageSize({ width: img.width, height: img.height })
              setRenderingStatus("Image生成完了")
            }
            img.onerror = () => {
              URL.revokeObjectURL(svgUrl)
              setImageUrl(null)
              setImageSize(null)
              setRenderingStatus("Image生成失敗")
            }
            img.src = svgUrl
          } else {
            setImageUrl(null)
            setImageSize(null)
            setRenderingStatus("SVG生成失敗")
          }
        } catch (error) {
          console.error("Imageプレビュー処理エラー:", error)
          setImageUrl(null)
          setImageSize(null)
          setRenderingStatus("Image生成エラー")
        }
      }

      renderImagePreview()
    }

    // クリーンアップ
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [
    textBox.text,
    textBox.width,
    textBox.height,
    textBox.horizontalAlign,
    textBox.verticalAlign,
  ])

  return (
    <div className="rounded border border-orange-300 bg-white p-2">
      <div className="mb-1 text-xs text-gray-500">
        ID: {textBox.id.substring(0, 8)}... | Imageサイズ:{" "}
        {imageSize ? `${imageSize.width} × ${imageSize.height}` : "N/A"}
      </div>
      <div className="flex min-h-[60px] items-center justify-center rounded border border-gray-200 bg-white p-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="SVG→Image変換結果"
            style={{
              maxWidth: "100%",
              maxHeight: "100px",
              objectFit: "contain",
            }}
          />
        ) : (
          <div className="text-sm text-gray-400">Image生成待機中...</div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>ステータス: {renderingStatus}</span>
        <span>元テキスト長: {textBox.text.length}文字</span>
      </div>
    </div>
  )
}
