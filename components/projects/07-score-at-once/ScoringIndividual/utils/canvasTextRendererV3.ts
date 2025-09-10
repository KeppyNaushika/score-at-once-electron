/**
 * @fileoverview Canvas描画システム V3統合版
 * @description textbox-on-canvas-v3の高品質機能を採点画面に完全統合
 * 
 * ## V3統合の主要改善点
 * - scrollWidth/scrollHeightによる正確な寸法測定
 * - 改行処理の最適化（\nで分割 → 単一行ずつ処理）
 * - MathJax高品質レンダリングの統合
 * - textbox-on-canvas-v3ユーティリティの直接使用
 */

import { 
  convertTextToSvg
} from '@/app/textbox-on-canvas-v3/utils/textConversionUtils'

/**
 * テキストレンダリングオプション（V3統合版）
 */
export interface TextRenderOptionsV3 {
  text: string
  color: string
  fontSize: number
  maxWidth: number
  maxHeight: number
  backgroundColor?: string
}

/**
 * テキスト描画寸法情報（V3統合版）
 */
export interface TextDimensionsV3 {
  width: number
  height: number
  scale: number
}

/**
 * SVG要素をCanvasに高品質描画する（V3統合版・アスペクト比維持）
 * @param svgElement 描画対象のSVG要素
 * @param maxWidth 最大幅
 * @param maxHeight 最大高さ
 * @param backgroundColor 背景色
 * @returns Canvas要素と寸法情報
 */
async function renderSvgToCanvasV3(
  svgElement: SVGSVGElement,
  maxWidth: number,
  maxHeight: number,
  backgroundColor: string = 'transparent'
): Promise<{ canvas: HTMLCanvasElement; actualWidth: number; actualHeight: number; scale: number }> {
  return new Promise((resolve) => {
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8',
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        // V3品質: アスペクト比維持でのスケーリング計算
        const originalWidth = img.width
        const originalHeight = img.height
        
        const scaleX = maxWidth / originalWidth
        const scaleY = maxHeight / originalHeight
        const scale = Math.min(scaleX, scaleY) // アスペクト比維持
        
        const scaledWidth = originalWidth * scale
        const scaledHeight = originalHeight * scale
        
        // Canvas作成
        const canvas = document.createElement('canvas')
        canvas.width = scaledWidth
        canvas.height = scaledHeight
        const ctx = canvas.getContext('2d')!
        
        // 背景描画
        if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, scaledWidth, scaledHeight)
        }
        
        // 高品質描画（中央配置）
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

        URL.revokeObjectURL(svgUrl)
        resolve({ 
          canvas, 
          actualWidth: scaledWidth, 
          actualHeight: scaledHeight, 
          scale 
        })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve({ 
          canvas: document.createElement('canvas'), 
          actualWidth: 0, 
          actualHeight: 0, 
          scale: 0 
        })
      }
      
      img.src = svgUrl
    } catch (error) {
      resolve({ 
        canvas: document.createElement('canvas'), 
        actualWidth: 0, 
        actualHeight: 0, 
        scale: 0 
      })
    }
  })
}

/**
 * MarkdownテキストをCanvasに描画（V3統合版）
 * @param options テキストレンダリングオプション
 * @returns Canvas要素と描画寸法情報
 */
export async function renderMarkdownToCanvasV3(
  options: TextRenderOptionsV3
): Promise<{ canvas: HTMLCanvasElement; dimensions: TextDimensionsV3 }> {
  const { text, color, fontSize, maxWidth, maxHeight, backgroundColor = 'transparent' } = options
  
  if (!text.trim()) {
    // 空テキスト用の空Canvas
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = maxHeight
    return {
      canvas,
      dimensions: { width: maxWidth, height: maxHeight, scale: 1 }
    }
  }

  try {
    // textbox-on-canvas-v3のpreprocessMathSyntax機能を使用（内部で自動処理）
    const processedText = text
    
    console.log('🚀 V3統合: convertTextToSvg開始', {
      originalText: text.substring(0, 50),
      processedText: processedText.substring(0, 50),
      fontSize,
      color
    })
    
    // textbox-on-canvas-v3の高品質convertTextToSvgを直接使用（正しいAPI）
    const svgElement = await convertTextToSvg(
      processedText,
      maxWidth,
      maxHeight,
      'left',   // horizontalAlign
      'top'     // verticalAlign
    )
    
    if (svgElement) {
      console.log('✅ V3統合: SVG生成成功')
      
      // V3品質でCanvasに描画
      const result = await renderSvgToCanvasV3(svgElement, maxWidth, maxHeight, backgroundColor)
      
      console.log('🎨 V3統合: Canvas描画完了', {
        actualWidth: result.actualWidth,
        actualHeight: result.actualHeight,
        scale: result.scale
      })
      
      return {
        canvas: result.canvas,
        dimensions: {
          width: result.actualWidth,
          height: result.actualHeight,
          scale: result.scale
        }
      }
    }

    console.log('❌ V3統合: SVG生成失敗、フォールバックCanvas使用')
    // フォールバック
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = maxHeight
    return {
      canvas,
      dimensions: { width: maxWidth, height: maxHeight, scale: 1 }
    }
    
  } catch (error) {
    console.error('💥 V3統合エラー:', error)
    // エラー時のフォールバック
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = maxHeight
    return {
      canvas,
      dimensions: { width: maxWidth, height: maxHeight, scale: 1 }
    }
  }
}

/**
 * V3統合版: テキストボックス用最適フォントサイズ計算
 * @param text テキスト内容
 * @param boxWidth ボックス幅
 * @param boxHeight ボックス高さ
 * @param baseFontSize ベースフォントサイズ
 * @param minFontSize 最小フォントサイズ
 * @param maxFontSize 最大フォントサイズ
 * @returns 最適なフォントサイズ
 */
export function calculateOptimalFontSizeV3(
  text: string,
  boxWidth: number,
  boxHeight: number,
  baseFontSize: number = 16,
  minFontSize: number = 8,
  maxFontSize: number = 72
): number {
  // V3: 改行ごとに処理（textbox-on-canvas-v3と同じロジック）
  const lines = text.split('\n') // 実際の改行文字で分割
  
  // 各行の長さを計算（数式は約2文字分）
  const maxLineLength = Math.max(...lines.map(line => {
    // MathJax記法の長さを調整
    return line
      .replace(/\$.*?\$/g, 'XX')        // インライン数式
      .replace(/\*\*(.*?)\*\*/g, '$1')  // 太字
      .replace(/<u>(.*?)<\/u>/g, '$1')  // 下線
      .length
  }))
  
  // 横幅基準計算
  const widthBasedSize = boxWidth / (maxLineLength * 0.6)
  
  // 高さ基準計算（MathJax行は1.5倍の高さ）
  const mathLines = lines.filter(line => line.includes('$')).length
  const adjustedLines = lines.length + mathLines * 0.5
  const heightBasedSize = boxHeight / (adjustedLines * 1.4)
  
  // 最適サイズ決定
  const optimalSize = Math.min(widthBasedSize, heightBasedSize, baseFontSize)
  return Math.max(Math.min(optimalSize, maxFontSize), minFontSize)
}

/**
 * V3統合版: 後方互換性のためのラッパー関数
 * 既存のcanvasTextRendererHybridからの移行を簡単にする
 */
export async function renderMarkdownToCanvas(
  options: TextRenderOptionsV3
): Promise<{ canvas: HTMLCanvasElement; dimensions: TextDimensionsV3 }> {
  console.log('🔄 V3統合版ラッパー関数経由でrenderMarkdownToCanvasV3を呼び出し')
  return renderMarkdownToCanvasV3(options)
}

export function calculateOptimalFontSize(
  text: string,
  boxWidth: number,
  boxHeight: number,
  baseFontSize: number = 16,
  minFontSize: number = 8,
  maxFontSize: number = 72
): number {
  console.log('🔄 V3統合版ラッパー関数経由でcalculateOptimalFontSizeV3を呼び出し')
  return calculateOptimalFontSizeV3(text, boxWidth, boxHeight, baseFontSize, minFontSize, maxFontSize)
}

// 型エイリアス（後方互換性用）
export type TextRenderOptions = TextRenderOptionsV3
export type TextDimensions = TextDimensionsV3