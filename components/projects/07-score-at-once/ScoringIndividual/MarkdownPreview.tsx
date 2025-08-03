"use client"

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeMathjax from 'rehype-mathjax/svg'
import { cn } from '@/lib/utils'

// LaTeX形式の数式も処理するためのヘルパー関数（MathJax用に簡素化）
function preprocessMathContent(content: string): string {
  // MathJaxはLaTeX形式も直接処理できるので、最小限の前処理のみ
  let processedContent = content
  
  // \( \) 形式をインライン数式に変換（オプション）
  processedContent = processedContent.replace(/\\\(\s*(.*?)\s*\\\)/g, (match, mathContent) => {
    return `$${mathContent.trim()}$`
  })
  
  // \[ \] 形式をブロック数式に変換（オプション）  
  processedContent = processedContent.replace(/\\\[\s*(.*?)\s*\\\]/gs, (match, mathContent) => {
    return `$$${mathContent.trim()}$$`
  })
  
  return processedContent
}

interface MarkdownPreviewProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

export function MarkdownPreview({ content, className, style }: MarkdownPreviewProps) {
  // 空のコンテンツの場合のフォールバック  
  if (!content.trim()) {
    return (
      <div 
        className={cn("text-gray-400 min-h-16 flex items-center", className)}
        style={style}
      >
        テキストを入力するとプレビューが表示されます
      </div>
    )
  }

  // LaTeX形式も含めて前処理
  const processedContent = preprocessMathContent(content)

  return (
    <div className={cn("prose prose-sm max-w-none", className)} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeMathjax]}
        components={{
          // カスタムコンポーネントで安全な書式処理
          p: ({ children, ...props }) => (
            <p className="mb-2 last:mb-0" {...props}>
              {children}
            </p>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-bold" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),
          // 下線は標準的なMarkdownにはないが、HTMLタグとして処理
          u: ({ children, ...props }) => (
            <u className="underline" {...props}>
              {children}
            </u>
          ),
          // コードブロック
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
                <code className="text-sm font-mono" {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          // リスト
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside mb-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside mb-2" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="mb-1" {...props}>
              {children}
            </li>
          ),
          // 見出し
          h1: ({ children, ...props }) => (
            <h1 className="text-xl font-bold mb-2" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-lg font-bold mb-2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-base font-bold mb-2" {...props}>
              {children}
            </h3>
          ),
          // 改行
          br: () => <br />,
          // 水平線
          hr: () => <hr className="my-4 border-gray-300" />,
        }}
        // XSS攻撃を防ぐためのオプション
        skipHtml={false} // HTMLタグを処理（下線のため）
        urlTransform={(url) => {
          // URLの安全性チェック（必要に応じて）
          try {
            const parsedUrl = new URL(url)
            // httpまたはhttpsのみを許可
            if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
              return url
            }
          } catch {
            // 無効なURLの場合は空文字を返す
          }
          return ''
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}