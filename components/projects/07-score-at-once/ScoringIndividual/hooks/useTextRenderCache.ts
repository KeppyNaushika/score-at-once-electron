/**
 * テキスト描画キャッシュシステム
 * Canvas描画時の非同期処理を避けるため、事前にレンダリング結果をキャッシュする
 */

import { useCallback, useRef, useEffect } from 'react'
import { renderMarkdownToCanvas, calculateOptimalFontSize, type TextDimensions } from '../utils/canvasTextRendererHybrid'
import type { DrawingElement } from '../types/answer-individual-types'

interface CachedTextRender {
  canvas: HTMLCanvasElement
  dimensions: TextDimensions
  hash: string
}

interface TextCacheKey {
  text: string
  color: string
  fontSize: number
  boxWidth: number
  boxHeight: number
}

export function useTextRenderCache() {
  const cacheRef = useRef<Map<string, CachedTextRender>>(new Map())
  
  // LaTeX記法をMarkdown記法に変換（RichTextEditorModalと同じ処理）
  const convertLatexToMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\\\(/g, '$')     // \( を $ に
      .replace(/\\\)/g, '$')     // \) を $ に
      .replace(/\\\[/g, '$$')    // \[ を $$ に
      .replace(/\\\]/g, '$$')    // \] を $$ に
  }, [])
  
  // キャッシュキーを生成
  const generateCacheKey = useCallback((key: TextCacheKey): string => {
    return `${key.text}|${key.color}|${key.fontSize}|${key.boxWidth}|${key.boxHeight}`
  }, [])
  
  // テキストを事前レンダリング
  const preRenderText = useCallback(async (element: DrawingElement, boxWidth: number, boxHeight: number) => {
    if (!element.text) return null
    
    // LaTeX記法をMarkdown記法に変換
    const processedText = convertLatexToMarkdown(element.text)
    
    // 最適なフォントサイズを計算（変換後のテキストで）
    const optimalFontSize = calculateOptimalFontSize(
      processedText,
      boxWidth,
      boxHeight,
      element.fontSize || 16
    )
    
    const cacheKey = generateCacheKey({
      text: processedText,
      color: element.color,
      fontSize: optimalFontSize,
      boxWidth,
      boxHeight
    })
    
    // 既にキャッシュされている場合はそれを返す
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey)!
    }
    
    try {
      // リッチテキストをレンダリング（変換後のテキストで）
      const result = await renderMarkdownToCanvas({
        text: processedText,
        color: element.color,
        fontSize: optimalFontSize,
        maxWidth: boxWidth,
        maxHeight: boxHeight,
        backgroundColor: 'transparent'
      })
      
      const cachedRender: CachedTextRender = {
        canvas: result.canvas,
        dimensions: result.dimensions,
        hash: cacheKey
      }
      
      // キャッシュに保存
      cacheRef.current.set(cacheKey, cachedRender)
      
      return cachedRender
    } catch (error) {
      return null
    }
  }, [generateCacheKey, convertLatexToMarkdown])
  
  // キャッシュされたテキストを取得
  const getCachedText = useCallback((element: DrawingElement, boxWidth: number, boxHeight: number): CachedTextRender | null => {
    if (!element.text) return null
    
    // LaTeX記法をMarkdown記法に変換
    const processedText = convertLatexToMarkdown(element.text)
    
    const optimalFontSize = calculateOptimalFontSize(
      processedText,
      boxWidth,
      boxHeight,
      element.fontSize || 16
    )
    
    const cacheKey = generateCacheKey({
      text: processedText,
      color: element.color,
      fontSize: optimalFontSize,
      boxWidth,
      boxHeight
    })
    
    return cacheRef.current.get(cacheKey) || null
  }, [generateCacheKey, convertLatexToMarkdown])
  
  // テキスト要素を事前レンダリング（バッチ処理）
  const preRenderElements = useCallback(async (elements: DrawingElement[], baseWidth: number, baseHeight: number) => {
    const textElements = elements.filter(element => element.type === 'text' && element.text)
    
    const renderPromises = textElements.map(async element => {
      if (element.textBoxWidth !== undefined && element.textBoxHeight !== undefined) {
        const boxWidth = element.textBoxWidth * baseWidth
        const boxHeight = element.textBoxHeight * baseHeight
        return await preRenderText(element, boxWidth, boxHeight)
      }
      return null
    })
    
    await Promise.all(renderPromises)
  }, [preRenderText])
  
  // キャッシュをクリア
  const clearCache = useCallback(() => {
    cacheRef.current.clear()
  }, [])
  
  // メモリリーク防止のためのクリーンアップ
  useEffect(() => {
    return () => {
      clearCache()
    }
  }, [clearCache])
  
  return {
    getCachedText,
    preRenderText,
    preRenderElements,
    clearCache
  }
}