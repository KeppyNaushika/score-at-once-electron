/**
 * Canvas上でリッチテキスト（改行、MathJax）を描画するためのユーティリティ
 */

import html2canvas from 'html2canvas'

export interface TextRenderOptions {
  text: string
  color: string
  fontSize: number
  maxWidth: number
  maxHeight: number
  backgroundColor?: string
}

export interface TextDimensions {
  width: number
  height: number
  scale: number
}

/**
 * MarkdownをHTMLに変換（OKLCH色を避けた標準CSSのみ使用）
 */
function renderMarkdownToHtml(text: string, color: string, fontSize: number): string {
  let html = text
  
  // LaTeX形式の数式を標準形式に変換
  html = html.replace(/\\\((.*?)\\\)/g, '$$$1$$')
  html = html.replace(/\\\[(.*?)\\\]/gs, '$$$$$$1$$$$')
  
  // Markdownの基本的な書式を変換（インラインスタイルで標準色のみ使用）
  html = html.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight: bold; color: ${color};">$1</strong>`)
  html = html.replace(/\*(.*?)\*/g, `<em style="font-style: italic; color: ${color};">$1</em>`)
  html = html.replace(/<u>(.*?)<\/u>/g, `<u style="text-decoration: underline; color: ${color};">$1</u>`)
  
  // 改行を<br>に変換
  html = html.replace(/\n/g, '<br>')
  
  // 数式の処理（MathJaxが処理できる形式で）
  html = html.replace(/\$\$(.*?)\$\$/gs, '<div style="text-align: center; margin: 8px 0; color: ' + color + ';">$$$$1$$</div>')
  html = html.replace(/\$(.*?)\$/g, '<span style="color: ' + color + ';">$$1$</span>')
  
  // 基本的なリスト処理
  html = html.replace(/^- (.*$)/gim, '<li style="color: ' + color + '; margin: 2px 0;">$1</li>')
  html = html.replace(/(<li.*<\/li>)/s, '<ul style="margin: 4px 0; padding-left: 20px;">$1</ul>')
  
  return `<div style="
    font-family: system-ui, -apple-system, sans-serif;
    font-size: ${fontSize}px;
    color: ${color};
    line-height: 1.4;
    word-wrap: break-word;
  ">${html}</div>`
}

/**
 * html2canvasを使用してMarkdownテキストをCanvasに変換
 */
async function renderMarkdownHtmlToCanvas(
  text: string,
  color: string,
  fontSize: number,
  maxWidth: number,
  maxHeight: number,
  backgroundColor = 'transparent'
): Promise<{ canvas: HTMLCanvasElement; dimensions: TextDimensions }> {
  return new Promise((resolve, reject) => {
    // 隠しコンテナを作成（OKLCH色を避けるため標準色のみ使用）
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    container.style.visibility = 'hidden'
    container.style.maxWidth = `${maxWidth}px`
    container.style.maxHeight = `${maxHeight}px`
    container.style.fontSize = `${fontSize}px`
    container.style.color = color
    container.style.backgroundColor = backgroundColor
    container.style.padding = '8px'
    container.style.boxSizing = 'border-box'
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
    
    // OKLCH色を避けるために基本的なCSSのみを適用
    container.style.lineHeight = '1.4'
    
    document.body.appendChild(container)
    
    // カスタムHTMLレンダラー（OKLCH色を避ける）
    const processedHtml = renderMarkdownToHtml(text, color, fontSize)
    container.innerHTML = processedHtml
    
    // MathJaxのレンダリングを待つ
    setTimeout(async () => {
      try {
        // 実際のサイズを測定
        const actualWidth = container.offsetWidth
        const actualHeight = container.offsetHeight
        
        // スケール計算
        const scaleX = maxWidth / actualWidth
        const scaleY = maxHeight / actualHeight
        const scale = Math.min(scaleX, scaleY, 1) // 縮小のみ
        
        const scaledWidth = actualWidth * scale
        const scaledHeight = actualHeight * scale
        
        // html2canvasでCanvas変換
        const canvas = await html2canvas(container, {
          width: actualWidth,
          height: actualHeight,
          background: backgroundColor === 'transparent' ? undefined : backgroundColor,
          logging: false,
          useCORS: true,
          allowTaint: true
        })
        
        // 手動でスケーリング（html2canvasのscaleオプションが無いため）
        if (scale !== 1) {
          const scaledCanvas = document.createElement('canvas')
          scaledCanvas.width = scaledWidth
          scaledCanvas.height = scaledHeight
          const scaledCtx = scaledCanvas.getContext('2d')
          
          if (scaledCtx) {
            scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight)
            // 元のcanvasを置き換え
            canvas.width = scaledWidth
            canvas.height = scaledHeight
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.drawImage(scaledCanvas, 0, 0)
            }
          }
        }
        
        // クリーンアップ
        document.body.removeChild(container)
        
        resolve({
          canvas,
          dimensions: {
            width: scaledWidth,
            height: scaledHeight,
            scale
          }
        })
      } catch (error) {
        // エラー時のクリーンアップ
        document.body.removeChild(container)
        reject(error)
      }
    }, 1500) // MathJaxレンダリングを十分に待つ
  })
}

/**
 * MarkdownテキストをCanvasに描画（html2canvas版）
 */
export async function renderMarkdownToCanvas(
  options: TextRenderOptions
): Promise<{ canvas: HTMLCanvasElement; dimensions: TextDimensions }> {
  const { text, color, fontSize, maxWidth, maxHeight, backgroundColor } = options
  
  return await renderMarkdownHtmlToCanvas(
    text,
    color,
    fontSize,
    maxWidth,
    maxHeight,
    backgroundColor
  )
}

/**
 * テキストのサイズを計算（Canvas measureTextの拡張版）
 */
export function calculateTextDimensions(
  text: string,
  fontSize: number,
  maxWidth: number
): { width: number; height: number; lines: string[] } {
  // 簡易的な改行処理
  const lines = text.split('\n')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    return { width: 0, height: 0, lines: [] }
  }
  
  ctx.font = `${fontSize}px sans-serif`
  
  const processedLines: string[] = []
  let maxLineWidth = 0
  
  lines.forEach(line => {
    if (line === '') {
      processedLines.push('')
      return
    }
    
    const lineWidth = ctx.measureText(line).width
    if (lineWidth <= maxWidth) {
      processedLines.push(line)
      maxLineWidth = Math.max(maxLineWidth, lineWidth)
    } else {
      // 単語単位で折り返し
      const words = line.split(' ')
      let currentLine = ''
      
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const testWidth = ctx.measureText(testLine).width
        
        if (testWidth <= maxWidth) {
          currentLine = testLine
        } else {
          if (currentLine) {
            processedLines.push(currentLine)
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
          }
          currentLine = word
        }
      })
      
      if (currentLine) {
        processedLines.push(currentLine)
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
      }
    }
  })
  
  const lineHeight = fontSize * 1.4
  const totalHeight = processedLines.length * lineHeight
  
  return {
    width: maxLineWidth,
    height: totalHeight,
    lines: processedLines
  }
}

/**
 * テキストボックスに合わせた最適なフォントサイズを計算
 */
export function calculateOptimalFontSize(
  text: string,
  boxWidth: number,
  boxHeight: number,
  baseFontSize: number = 16,
  minFontSize: number = 8,
  maxFontSize: number = 72
): number {
  let fontSize = baseFontSize
  let bestFit = minFontSize
  
  // 二分探索で最適なフォントサイズを見つける
  let low = minFontSize
  let high = maxFontSize
  
  while (low <= high) {
    fontSize = Math.floor((low + high) / 2)
    const dimensions = calculateTextDimensions(text, fontSize, boxWidth)
    
    if (dimensions.width <= boxWidth && dimensions.height <= boxHeight) {
      bestFit = fontSize
      low = fontSize + 1
    } else {
      high = fontSize - 1
    }
  }
  
  return bestFit
}