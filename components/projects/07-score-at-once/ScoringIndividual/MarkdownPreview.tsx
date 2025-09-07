"use client"

/**
 * 安全なMarkdownプレビューコンポーネント
 * - ReactMarkdownによる安全な変換
 * - dangerouslySetInnerHTMLを使用しない
 * - XSS脆弱性を回避
 */

import React from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeMathjax from "rehype-mathjax/svg"
import { cn } from "@/lib/utils"

interface MarkdownPreviewProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

/**
 * 安全なMarkdownプレビューコンポーネント
 */
export function MarkdownPreview({
  content,
  className,
  style,
}: MarkdownPreviewProps) {
  // 空のコンテンツの場合のフォールバック
  if (!content.trim()) {
    return (
      <div
        className={cn(
          "flex min-h-16 items-center justify-center text-gray-400",
          className,
        )}
        style={style}
      >
        テキストを入力するとプレビューが表示されます
      </div>
    )
  }

  return (
    <div
      className={cn("prose prose-sm max-w-none", className)}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif',
        fontSize: "14px",
        lineHeight: "1.6",
        color: "#000000",
        background: "white",
        ...style,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeMathjax]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}