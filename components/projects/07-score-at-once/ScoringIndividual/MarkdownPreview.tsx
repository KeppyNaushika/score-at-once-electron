"use client"

/**
 * textbox-on-canvasのconvertTextToSvg完全移植版：MarkdownPreview
 * - textbox-on-canvasと完全に同じ高度な処理ロジック
 * - MutationObserver + MathJax + スタイルクリーンアップ
 * - SVG変換部分をHTML表示に変更しただけ
 */

import React, { useEffect, useRef, useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeMathjax from "rehype-mathjax/svg"
import { createRoot } from "react-dom/client"
import { cn } from "@/lib/utils"

interface MarkdownPreviewProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

/**
 * textbox-on-canvasのconvertTextToSvg関数と完全に同じロジックでHTMLプレビューを生成
 */
export function MarkdownPreview({
  content,
  className,
  style,
}: MarkdownPreviewProps) {
  const [renderedContent, setRenderedContent] = useState<string>("")
  const [isRendering, setIsRendering] = useState(false)

  /**
   * textbox-on-canvasのconvertTextToSvg関数を完全移植（HTML版）
   */
  const convertTextToHtml = useCallback(
    async (text: string): Promise<string | null> => {
      if (!text.trim()) return null

      /**
       * textbox-on-canvasと完全に同じDOM容器作成
       */
      const createTempPreviewContainer = (): HTMLDivElement => {
        const tempPreviewDiv = document.createElement("div")
        tempPreviewDiv.style.cssText = `
          position: absolute;
          left: -9999px;
          top: -9999px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #000000;
          background: white;
          padding: 0;
          margin: 0;
          border: 0;
          width: max-content;
          height: max-content;
          display: block;
        `
        document.body.appendChild(tempPreviewDiv)
        return tempPreviewDiv
      }

      /**
       * textbox-on-canvasと完全に同じReactMarkdownレンダリング
       */
      const renderReactMarkdown = (container: HTMLDivElement) => {
        const root = createRoot(container)
        root.render(
          React.createElement(
            ReactMarkdown,
            {
              remarkPlugins: [remarkMath],
              rehypePlugins: [rehypeMathjax],
            },
            text,
          ),
        )
        return root
      }

      /**
       * textbox-on-canvasと完全に同じブラウザ描画完了待機
       */
      const waitForRenderingComplete = async (
        frames: number = 2,
      ): Promise<void> => {
        for (let i = 0; i < frames; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve))
        }
      }

      /**
       * textbox-on-canvasと完全に同じMathJax処理
       */
      const processMathJax = async (
        container: HTMLDivElement,
      ): Promise<void> => {
        const MJ = (window as any).MathJax
        if (MJ && MJ.typesetPromise) {
          try {
            await MJ.typesetPromise([container])
            await waitForRenderingComplete()
          } catch (mathError) {
            // MathJax処理失敗時も継続
          }
        }
      }

      /**
       * textbox-on-canvasと完全に同じ要素スタイルクリーンアップ
       */
      const cleanupElementStyles = (container: HTMLDivElement): void => {
        const allElements = container.querySelectorAll("*")
        allElements.forEach((el) => {
          const element = el as HTMLElement
          element.style.margin = "0"
          element.style.padding = "0"
          element.style.border = "0"
        })

        // textbox-on-canvasと同じ特別クリーンアップ
        const pElements = container.querySelectorAll("p")
        const mjxElements = container.querySelectorAll("mjx-container")

        pElements.forEach((p) => {
          p.style.margin = "0 0 8px 0" // プレビュー用に適度な余白
          p.style.padding = "0"
          p.style.lineHeight = "1.6"
        })

        mjxElements.forEach((mjx) => {
          const mjxEl = mjx as HTMLElement
          mjxEl.style.margin = "0"
          mjxEl.style.padding = "0"
        })
      }

      /**
       * textbox-on-canvasと完全に同じクリーンアップ処理
       */
      const performCleanup = (root: any, container: HTMLDivElement): void => {
        try {
          root.unmount()
          document.body.removeChild(container)
        } catch (cleanupError) {
          // クリーンアップ失敗時も継続
        }
      }

      /**
       * textbox-on-canvasと完全に同じDOM変更検出
       */
      const hasSignificantChanges = (mutations: MutationRecord[]): boolean => {
        return mutations.some(
          (mutation) =>
            mutation.type === "childList" &&
            (mutation.addedNodes.length > 0 ||
              mutation.removedNodes.length > 0),
        )
      }

      /**
       * textbox-on-canvasと完全に同じレンダリング後処理（HTML版）
       */
      const processRenderedContent = async (
        container: HTMLDivElement,
        root: any,
        resolve: (value: string | null) => void,
      ): Promise<void> => {
        try {
          await waitForRenderingComplete()
          await processMathJax(container)
          cleanupElementStyles(container)
          await waitForRenderingComplete(1)

          // SVG作成ではなくHTMLを返す（ここだけ違い）
          const htmlContent = container.innerHTML
          performCleanup(root, container)

          resolve(htmlContent)
        } catch (error) {
          performCleanup(root, container)
          resolve(null)
        }
      }

      try {
        const tempPreviewDiv = createTempPreviewContainer()
        const root = renderReactMarkdown(tempPreviewDiv)

        return new Promise((resolve) => {
          let renderingComplete = false

          const observer = new MutationObserver(async (mutations) => {
            if (renderingComplete) return

            if (
              hasSignificantChanges(mutations) &&
              tempPreviewDiv.children.length > 0
            ) {
              renderingComplete = true
              observer.disconnect()
              await processRenderedContent(tempPreviewDiv, root, resolve)
            }
          })

          observer.observe(tempPreviewDiv, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          })

          // textbox-on-canvasと同じフォールバックタイムアウト
          setTimeout(() => {
            if (!renderingComplete) {
              observer.disconnect()
              performCleanup(root, tempPreviewDiv)
              resolve(null)
            }
          }, 10000)
        })
      } catch (error) {
        return null
      }
    },
    [], // textbox-on-canvasと同じ依存関係なし
  )

  // textbox-on-canvasと同じロジックでHTMLレンダリング
  useEffect(() => {
    if (!content.trim()) {
      setRenderedContent("")
      return
    }

    setIsRendering(true)

    const renderContent = async () => {
      try {
        const htmlContent = await convertTextToHtml(content)
        setRenderedContent(htmlContent || "")
        setIsRendering(false)
      } catch (error) {
        setRenderedContent("")
        setIsRendering(false)
      }
    }

    renderContent()
  }, [content, convertTextToHtml])

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

  // ローディング状態
  if (isRendering) {
    return (
      <div
        className={cn(
          "flex min-h-16 items-center justify-center text-gray-400",
          className,
        )}
        style={style}
      >
        レンダリング中...
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
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}
