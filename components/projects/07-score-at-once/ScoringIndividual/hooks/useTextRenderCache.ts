/**
 * テキスト描画キャッシュシステム
 * Canvas描画時の非同期処理を避けるため、事前にレンダリング結果をキャッシュする
 */

import { useCallback, useRef, useEffect } from 'react'
import { renderMarkdownToCanvas, calculateOptimalFontSize, type TextDimensions } from '../utils/canvasTextRenderer'
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
  
  // キャッシュキーを生成
  const generateCacheKey = useCallback((key: TextCacheKey): string => {
    return `${key.text}|${key.color}|${key.fontSize}|${key.boxWidth}|${key.boxHeight}`
  }, [])
  
  // テキストを事前レンダリング
  const preRenderText = useCallback(async (element: DrawingElement, boxWidth: number, boxHeight: number) => {
    if (!element.text) return null
    
    // 最適なフォントサイズを計算
    const optimalFontSize = calculateOptimalFontSize(
      element.text,
      boxWidth,
      boxHeight,
      element.fontSize || 16
    )
    
    const cacheKey = generateCacheKey({
      text: element.text,
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
      // リッチテキストをレンダリング
      const result = await renderMarkdownToCanvas({
        text: element.text,
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
      console.error('Failed to render text:', error)
      return null
    }
  }, [generateCacheKey])
  
  // キャッシュされたテキストを取得
  const getCachedText = useCallback((element: DrawingElement, boxWidth: number, boxHeight: number): CachedTextRender | null => {
    if (!element.text) return null
    
    const optimalFontSize = calculateOptimalFontSize(
      element.text,
      boxWidth,
      boxHeight,
      element.fontSize || 16
    )
    
    const cacheKey = generateCacheKey({
      text: element.text,
      color: element.color,
      fontSize: optimalFontSize,
      boxWidth,
      boxHeight
    })
    
    return cacheRef.current.get(cacheKey) || null
  }, [generateCacheKey])
  
  // テキスト要素を事前レンダリング（バッチ処理）
  const preRenderElements = useCallback(async (elements: DrawingElement[], baseWidth: number, baseHeight: number) => {
    const renderPromises = elements
      .filter(element => element.type === 'text' && element.text)
      .map(async element => {
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