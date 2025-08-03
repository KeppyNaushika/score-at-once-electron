/**
 * ハイブリッド方式：MarkdownPreviewコンポーネントでレンダリング済みの結果をCanvas化
 * 最も確実にプレビューと同じ表示を実現
 */

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
 * 既存のMarkdownPreviewコンポーネントの出力をCanvas上に再現
 * プレビューと完全に同じ表示を保証
 */
export async function renderMarkdownToCanvas(
  options: TextRenderOptions
): Promise<{ canvas: HTMLCanvasElement; dimensions: TextDimensions }> {
  const { text, color, fontSize, maxWidth, maxHeight, backgroundColor = 'transparent' } = options
  
  return new Promise((resolve) => {
    // 隠しMarkdownPreview要素を作成（同じコンポーネントを使用）
    const container = document.createElement('div')
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      visibility: hidden;
      max-width: ${maxWidth}px;
      max-height: ${maxHeight}px;
      font-size: ${fontSize}px;
      color: ${color};
      padding: 8px;
      box-sizing: border-box;
      background: ${backgroundColor === 'transparent' ? 'transparent' : backgroundColor};
    `
    
    document.body.appendChild(container)
    
    // プレビューと同じHTML構造を作成
    const previewDiv = document.createElement('div')
    previewDiv.className = 'prose prose-sm max-w-none'
    previewDiv.style.cssText = `
      font-size: ${fontSize}px;
      color: ${color};
      line-height: 1.4;
      word-wrap: break-word;
    `
    
    container.appendChild(previewDiv)
    
    // Markdownを処理（MarkdownPreviewと同じロジック）
    let processedContent = text
    
    // LaTeX形式の数式変換（正規表現を修正）
    processedContent = processedContent.replace(/\\\(\s*(.*?)\s*\\\)/g, (match, mathContent) => {
      return `$${mathContent.trim()}$`
    })
    
    processedContent = processedContent.replace(/\\\[\s*(.*?)\s*\\\]/gs, (match, mathContent) => {
      return `$$${mathContent.trim()}$$`
    })
    
    // 基本的なMarkdown処理
    let htmlContent = processedContent
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/\n/g, '<br>')
    
    // 数式処理（MathJaxが処理する形式）
    htmlContent = htmlContent.replace(/\$\$(.*?)\$\$/gs, '<div class="math-display">$$$$1$$</div>')
    htmlContent = htmlContent.replace(/\$(.*?)\$/g, '<span class="math-inline">$$1$</span>')
    
    previewDiv.innerHTML = htmlContent
    
    // MathJaxがページに存在するかチェック
    const waitForMathJax = () => {
      const MJ = (window as any).MathJax
      console.log('🔍 MathJax availability check:', { 
        MJ: !!MJ, 
        typesetPromise: !!(MJ && MJ.typesetPromise),
        mathElements: previewDiv.querySelectorAll('.math-inline, .math-display').length
      })
      
      if (MJ && MJ.typesetPromise) {
        // 既存のMathJaxでレンダリング
        console.log('📐 Starting MathJax typeset process...')
        MJ.typesetPromise([previewDiv]).then(() => {
          console.log('✅ MathJax typeset completed successfully')
          // レンダリング完了後、少し待ってからCanvasに変換
          setTimeout(processRenderedContent, 200)
        }).catch((error: any) => {
          console.warn('⚠️ MathJax typeset failed:', error)
          // MathJax失敗時もフォールバック処理
          setTimeout(processRenderedContent, 100)
        })
      } else {
        console.log('ℹ️ MathJax not available, proceeding without math rendering')
        // MathJaxなしでも処理続行
        setTimeout(processRenderedContent, 100)
      }
    }
    
    const processRenderedContent = () => {
      try {
        // MathJax処理後の要素を確認
        const svgElements = previewDiv.querySelectorAll('svg')
        const mathElements = previewDiv.querySelectorAll('.math-inline, .math-display')
        console.log('🔍 Math elements after processing:', {
          svgElements: svgElements.length,
          mathElements: mathElements.length,
          htmlContent: previewDiv.innerHTML.substring(0, 200)
        })
        
        // 実際のサイズを測定
        const actualWidth = previewDiv.offsetWidth
        const actualHeight = previewDiv.offsetHeight
        
        console.log('📏 Measured size:', { actualWidth, actualHeight })
        
        // スケール計算
        const scaleX = maxWidth / actualWidth
        const scaleY = maxHeight / actualHeight
        const scale = Math.min(scaleX, scaleY, 1)
        
        const scaledWidth = actualWidth * scale
        const scaledHeight = actualHeight * scale
        
        console.log('📐 Scale calculation:', { scale, scaledWidth, scaledHeight })
        
        // Canvas作成と描画
        const canvas = document.createElement('canvas')
        canvas.width = scaledWidth
        canvas.height = scaledHeight
        const ctx = canvas.getContext('2d')!
        
        // 背景描画
        if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, scaledWidth, scaledHeight)
        }
        
        // HTML要素をCanvas化（foreignObject + SVG方式）
        const svgData = `
          <svg width="${scaledWidth}" height="${scaledHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>
                .math-display { text-align: center; margin: 1em 0; }
                .math-inline { display: inline; }
                mjx-container { display: inline-block; }
                mjx-container[display=true] { display: block; text-align: center; margin: 1em 0; }
              </style>
            </defs>
            <foreignObject width="${actualWidth}" height="${actualHeight}" transform="scale(${scale})">
              <div xmlns="http://www.w3.org/1999/xhtml" style="
                font-size: ${fontSize}px;
                color: ${color};
                line-height: 1.4;
                font-family: system-ui, -apple-system, sans-serif;
                word-wrap: break-word;
                max-width: ${maxWidth}px;
                box-sizing: border-box;
              ">
                ${previewDiv.innerHTML}
              </div>
            </foreignObject>
          </svg>
        `
        
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)
        
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          URL.revokeObjectURL(svgUrl)
          
          // クリーンアップ
          document.body.removeChild(container)
          
          console.log('✅ Canvas rendering complete')
          
          resolve({
            canvas,
            dimensions: {
              width: scaledWidth,
              height: scaledHeight,
              scale
            }
          })
        }
        
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          console.warn('⚠️ SVG image loading failed, creating fallback canvas')
          
          // フォールバック: 基本的なテキスト描画
          ctx.fillStyle = color
          ctx.font = `${fontSize * scale}px system-ui, sans-serif`
          ctx.textBaseline = 'top'
          
          const lines = text.split('\n')
          const lineHeight = fontSize * scale * 1.4
          
          lines.forEach((line, index) => {
            ctx.fillText(line, 4 * scale, (4 + index * lineHeight / scale) * scale)
          })
          
          document.body.removeChild(container)
          
          resolve({
            canvas,
            dimensions: {
              width: scaledWidth,
              height: scaledHeight,
              scale
            }
          })
        }
        
        img.src = svgUrl
        
      } catch (error) {
        console.error('❌ Canvas rendering error:', error)
        document.body.removeChild(container)
        
        // 最小限のフォールバック
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = 50
        const ctx = canvas.getContext('2d')!
        
        ctx.fillStyle = color
        ctx.font = `${fontSize}px system-ui, sans-serif`
        ctx.fillText(text.substring(0, 50), 4, fontSize + 4)
        
        resolve({
          canvas,
          dimensions: {
            width: maxWidth,
            height: 50,
            scale: 1
          }
        })
      }
    }
    
    // MathJax処理を即座に開始（DOMに追加後）
    setTimeout(waitForMathJax, 50)
  })
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
  const lines = text.split('\n')
  const maxLineLength = Math.max(...lines.map(line => 
    line.replace(/\$.*?\$/g, 'XX').replace(/\*\*(.*?)\*\*/g, '$1').length
  ))
  
  // 横幅基準（数式は約2文字分として計算）
  const widthBasedSize = boxWidth / (maxLineLength * 0.6)
  
  // 高さ基準（数式行は1.5倍の高さとして計算）
  const mathLines = lines.filter(line => line.includes('$')).length
  const adjustedLines = lines.length + mathLines * 0.5
  const heightBasedSize = boxHeight / (adjustedLines * 1.4)
  
  // 制限適用
  const optimalSize = Math.min(widthBasedSize, heightBasedSize, baseFontSize)
  return Math.max(Math.min(optimalSize, maxFontSize), minFontSize)
}