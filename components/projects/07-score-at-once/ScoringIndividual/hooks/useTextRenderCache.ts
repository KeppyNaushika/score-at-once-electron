/**
 * テキスト描画キャッシュシステム
 * Canvas描画時の非同期処理を避けるため、事前にレンダリング結果をキャッシュする
 */

import { useCallback, useRef, useEffect } from 'react'
import { renderMarkdownToCanvasV3, calculateOptimalFontSizeV3, type TextDimensionsV3 } from '../utils/canvasTextRendererV3'
import type { DrawingElement } from '../types/answer-individual-types'

interface CachedTextRender {
  canvas: HTMLCanvasElement
  dimensions: TextDimensionsV3
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
  
  // V3統合: LaTeX処理はtextbox-on-canvas-v3内で自動実行される
  
  // キャッシュキーを生成
  const generateCacheKey = useCallback((key: TextCacheKey): string => {
    return `${key.text}|${key.color}|${key.fontSize}|${key.boxWidth}|${key.boxHeight}`
  }, [])
  
  // テキストを事前レンダリング
  const preRenderText = useCallback(async (element: DrawingElement, boxWidth: number, boxHeight: number) => {
    if (!element.text) return null
    
    // V3統合: LaTeX処理は内部で自動実行
    const processedText = element.text
    
    // V3統合: 最適なフォントサイズを計算（変換後のテキストで）
    const optimalFontSize = calculateOptimalFontSizeV3(
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
      // V3統合: リッチテキストをレンダリング（変換後のテキストで）
      const result = await renderMarkdownToCanvasV3({
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
  }, [generateCacheKey])
  
  // キャッシュされたテキストを取得
  const getCachedText = useCallback((element: DrawingElement, boxWidth: number, boxHeight: number): CachedTextRender | null => {
    if (!element.text) return null
    
    // V3統合: LaTeX処理は内部で自動実行
    const processedText = element.text
    
    const optimalFontSize = calculateOptimalFontSizeV3(
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
  }, [generateCacheKey])
  
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