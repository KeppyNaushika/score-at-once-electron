/* eslint-disable @next/next/no-img-element */
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
    if (textBox.text.trim()) {
      let isCancelled = false
      let currentImageUrl: string | null = null

      const renderImagePreview = async () => {
        try {
          setRenderingStatus("Image生成中...")

          // アンカーベースのSVG生成処理
          const estimatedWidth = textBox.text.length * textBox.textSize * 0.6
          const estimatedHeight = textBox.textSize * 1.2

          const svgElement = await convertTextToSvg(
            textBox.text,
            estimatedWidth,
            estimatedHeight,
            "left",
            "top",
            textBox.textSize,
          )

          if (isCancelled) return

          if (svgElement) {
            // SVG→Blob→Image変換
            const svgData = new XMLSerializer().serializeToString(svgElement)

            const svgBlob = new Blob([svgData], {
              type: "image/svg+xml;charset=utf-8",
            })
            const svgUrl = URL.createObjectURL(svgBlob)
            currentImageUrl = svgUrl

            const img = new Image()
            img.onload = () => {
              if (!isCancelled) {
                setImageUrl(svgUrl)
                setImageSize({ width: img.width, height: img.height })
                setRenderingStatus("Image生成完了")
              } else {
                URL.revokeObjectURL(svgUrl)
              }
            }
            img.onerror = () => {
              if (!isCancelled) {
                URL.revokeObjectURL(svgUrl)
                setImageUrl(null)
                setImageSize(null)
                setRenderingStatus("Image生成失敗")
              } else {
                URL.revokeObjectURL(svgUrl)
              }
            }
            img.src = svgUrl
          } else {
            if (!isCancelled) {
              setImageUrl(null)
              setImageSize(null)
              setRenderingStatus("SVG生成失敗")
            }
          }
        } catch (error) {
          if (!isCancelled) {
            // Imageプレビュー処理エラー
            setImageUrl(null)
            setImageSize(null)
            setRenderingStatus("Image生成エラー")
          }
        }
      }

      renderImagePreview()

      // クリーンアップ
      return () => {
        isCancelled = true
        if (currentImageUrl) {
          URL.revokeObjectURL(currentImageUrl)
        }
      }
    } else {
      let cancelled = false
      const frame = requestAnimationFrame(() => {
        if (cancelled) {
          return
        }
        setImageUrl(null)
        setImageSize(null)
        setRenderingStatus("待機中")
      })

      return () => {
        cancelled = true
        cancelAnimationFrame(frame)
      }
    }
  }, [textBox.text, textBox.textSize])

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
