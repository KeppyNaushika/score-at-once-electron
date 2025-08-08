"use client"

import { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestMathJaxOnCanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mathText, setMathText] = useState('文字 b b b \\( b \\) \\( \\dfrac{3}{2}b \\)')
  const [status, setStatus] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  // テキストを数式部分と通常テキスト部分に分離
  const parseTextWithMath = (text: string) => {
    const parts: Array<{type: 'text' | 'math', content: string}> = []
    
    // 数式パターンを検出する正規表現（優先度順）
    const mathPatterns = [
      { pattern: /\$\$(.*?)\$\$/g, type: 'display' },  // $$...$$
      { pattern: /\$(.*?)\$/g, type: 'inline' },       // $...$
      { pattern: /\\\[(.*?)\\\]/g, type: 'display' },   // \[...\]
      { pattern: /\\\((.*?)\\\)/g, type: 'inline' }     // \(...\)
    ]
    
    let currentText = text
    let allMatches: Array<{start: number, end: number, content: string, type: string}> = []
    
    // 全ての数式パターンを検出
    mathPatterns.forEach(({pattern, type}) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[0],
          type
        })
      }
    })
    
    // 位置順にソート
    allMatches.sort((a, b) => a.start - b.start)
    
    // 重複を除去（内側の数式を優先）
    const filteredMatches: Array<{start: number, end: number, content: string, type: string}> = []
    for (let i = 0; i < allMatches.length; i++) {
      const current = allMatches[i]
      const isOverlapped = filteredMatches.some(existing => 
        (current.start >= existing.start && current.start < existing.end) ||
        (current.end > existing.start && current.end <= existing.end) ||
        (current.start <= existing.start && current.end >= existing.end)
      )
      if (!isOverlapped) {
        filteredMatches.push(current)
      }
    }
    
    // テキストと数式を順序通りに分離
    let lastEnd = 0
    filteredMatches.forEach(match => {
      // 前の数式の後から現在の数式の前までのテキスト
      if (match.start > lastEnd) {
        const textContent = text.slice(lastEnd, match.start).trim()
        if (textContent) {
          parts.push({type: 'text', content: textContent})
        }
      }
      
      // 数式部分
      parts.push({type: 'math', content: match.content})
      lastEnd = match.end
    })
    
    // 最後の数式の後のテキスト
    if (lastEnd < text.length) {
      const textContent = text.slice(lastEnd).trim()
      if (textContent) {
        parts.push({type: 'text', content: textContent})
      }
    }
    
    // 数式が見つからない場合は全体をテキストとして扱う
    if (parts.length === 0 && text.trim()) {
      parts.push({type: 'text', content: text.trim()})
    }
    
    return parts
  }

  // SVGを個別に画像化（位置指定可能版）
  const renderSvgToImageAtPosition = async (
    svgElement: SVGSVGElement, 
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number,
    scale: number = 1
  ): Promise<{width: number, height: number}> => {
    // MathJaxのグローバル定義を収集
    const globalDefs = document.querySelector('mjx-container defs') || document.querySelector('svg defs')
    let globalDefsContent = ''
    
    if (globalDefs) {
      globalDefsContent = globalDefs.outerHTML
    } else {
      const allMjxContainers = document.querySelectorAll('mjx-container')
      const collectedDefs = new Set<string>()
      
      allMjxContainers.forEach((container) => {
        const containerDefs = container.querySelectorAll('defs')
        containerDefs.forEach(def => {
          const defPaths = def.querySelectorAll('path[id]')
          defPaths.forEach(path => {
            const id = path.getAttribute('id')
            if (id) {
              collectedDefs.add(path.outerHTML)
            }
          })
        })
      })
      
      if (collectedDefs.size > 0) {
        globalDefsContent = `<defs>${Array.from(collectedDefs).join('')}</defs>`
      }
    }

    // SVGを完全に自己完結させる
    const width = svgElement.getAttribute('width') || '100'
    const height = svgElement.getAttribute('height') || '50'
    const viewBox = svgElement.getAttribute('viewBox') || '0 0 100 50'
    
    const completeSvgData = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
           width="${width}" 
           height="${height}"
           viewBox="${viewBox}"
           style="background: transparent;">
        ${globalDefsContent}
        ${svgElement.innerHTML}
      </svg>`
    
    return new Promise((resolve) => {
      try {
        const svgBlob = new Blob([completeSvgData], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)

        const img = new Image()
        img.onload = () => {
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          
          // 画像を描画
          ctx.globalAlpha = 1.0
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
          
          URL.revokeObjectURL(svgUrl)
          resolve({width: scaledWidth, height: scaledHeight})
        }
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          resolve({width: 0, height: 0})
        }
        img.src = svgUrl
      } catch (error) {
        console.error('SVG処理エラー:', error)
        resolve({width: 0, height: 0})
      }
    })
  }

  // 統合表示：テキストと数式を混在表示
  const renderMathToCanvas = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setStatus('🔄 統合レンダリング中...')

    try {
      // Canvasをクリア  
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // テキストを数式とテキスト部分に分離
      const parts = parseTextWithMath(text)
      console.log('📝 解析結果:', parts)

      if (parts.length === 0) {
        ctx.fillStyle = '#666666'
        ctx.font = '20px Arial'
        ctx.fillText('入力がありません', 50, 100)
        setStatus('⚠️ 入力がありません')
        return
      }

      // 描画設定
      const fontSize = 24
      const lineHeight = 40
      let currentX = 50
      let currentY = 100
      const maxWidth = canvas.width - 100 // マージンを考慮

      // ベースライン統一のための設定
      ctx.textBaseline = 'alphabetic'  // テキストをベースライン基準で描画
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", Arial, sans-serif`

      let mathCount = 0
      let textCount = 0

      // ベースライン統一の基準線
      let baselineLine = currentY
      
      // テキストメトリクス取得
      const textMetrics = ctx.measureText('あ')
      const textBaseline = textMetrics.actualBoundingBoxAscent
      
      console.log(`📐 ベースラインアプローチ: baselineLine=${baselineLine}px, textBaseline=${textBaseline}px`)

      // 数式部分のMathJax処理を事前に実行
      const mathParts = parts.filter(part => part.type === 'math')
      let svgElements: SVGSVGElement[] = []

      if (mathParts.length > 0) {
        // 隠しDIV要素で数式をまとめて処理
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = `
          position: absolute;
          left: -9999px;
          top: -9999px;
          visibility: hidden;
          font-size: ${fontSize}px;
          color: #000000;
          padding: 20px;
          background: white;
        `
        
        // 全ての数式をDIVに追加（LaTeX記法を$記法に変換）
        const mathTexts = mathParts.map(part => 
          part.content
            .replace(/\\\(/g, '$')
            .replace(/\\\)/g, '$')
            .replace(/\\\[/g, '$$')
            .replace(/\\\]/g, '$$')
        )
        
        tempDiv.innerHTML = mathTexts.join('<br>')
        document.body.appendChild(tempDiv)

        // MathJax処理を待つ
        const MJ = (window as any).MathJax
        if (MJ && MJ.typesetPromise) {
          await MJ.typesetPromise([tempDiv])
          svgElements = Array.from(tempDiv.querySelectorAll('mjx-container svg')) as SVGSVGElement[]
          console.log(`✅ MathJax処理完了: ${svgElements.length}個のSVG`)
        }

        document.body.removeChild(tempDiv)
      }

      let svgIndex = 0

      // 各パートを順次描画
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]

        if (part.type === 'text') {
          // 通常テキストの描画
          const textContent = part.content
          textCount++

          // テキストの幅を測定
          const textMetrics = ctx.measureText(textContent)
          const textWidth = textMetrics.width

          // 改行チェック
          if (currentX + textWidth > maxWidth && currentX > 50) {
            currentX = 50
            currentY += lineHeight
            // ベースライン基準線も更新
            baselineLine = currentY
          }

          // テキストを描画（ベースライン基準）
          ctx.fillStyle = '#000000'
          ctx.fillText(textContent, currentX, baselineLine + textBaseline)
          
          console.log(`📝 テキスト描画: "${textContent}" at (${currentX}, ${baselineLine + textBaseline})`)
          
          currentX += textWidth + 10 // スペースを追加

        } else if (part.type === 'math' && svgIndex < svgElements.length) {
          // 数式の描画
          const svgElement = svgElements[svgIndex]
          mathCount++
          svgIndex++

          // MathJaxのex単位を正しくピクセルに変換
          const widthAttr = svgElement.getAttribute('width') || '50px'
          const heightAttr = svgElement.getAttribute('height') || '30px'
          const svgViewBox = svgElement.getAttribute('viewBox')
          
          // ex単位からピクセルへの変換（1ex ≈ 8-10px、フォントサイズ24pxの場合）
          const exToPxRatio = 24 * 0.5 // 24px font-size * 0.5 (1ex ≈ 0.5em)
          
          let svgWidth, svgHeight
          
          if (widthAttr.includes('ex')) {
            svgWidth = parseFloat(widthAttr) * exToPxRatio
          } else {
            svgWidth = parseFloat(widthAttr)
          }
          
          if (heightAttr.includes('ex')) {
            svgHeight = parseFloat(heightAttr) * exToPxRatio
          } else {
            svgHeight = parseFloat(heightAttr)
          }
          
          // MathJax SVGの詳細デバッグ解析
          console.log(`🔍 ============= 数式"${part.content}"の詳細解析 =============`)
          console.log(`📊 SVG基本情報:`)
          console.log(`  width属性: ${widthAttr}`)
          console.log(`  height属性: ${heightAttr}`)
          console.log(`  計算サイズ: ${svgWidth} x ${svgHeight}px`)
          console.log(`  viewBox: ${svgViewBox}`)
          
          // SVGのDOMツリー構造を解析
          const svgInnerHTML = svgElement.innerHTML
          console.log(`📋 SVG内容 (先頭200文字):`)
          console.log(`  ${svgInnerHTML.substring(0, 200)}...`)
          
          // SVG内のテキスト要素を探索
          const textElements = svgElement.querySelectorAll('text')
          const useElements = svgElement.querySelectorAll('use')
          const pathElements = svgElement.querySelectorAll('path')
          
          console.log(`🔤 SVG内要素数:`)
          console.log(`  text要素: ${textElements.length}個`)
          console.log(`  use要素: ${useElements.length}個`)
          console.log(`  path要素: ${pathElements.length}個`)
          
          // 各text要素の詳細解析
          textElements.forEach((textEl, idx) => {
            const x = textEl.getAttribute('x') || '0'
            const y = textEl.getAttribute('y') || '0'
            const content = textEl.textContent || ''
            console.log(`  text[${idx}]: content="${content}", x=${x}, y=${y}`)
          })
          
          // 各use要素の詳細解析（文字グリフの参照）
          useElements.forEach((useEl, idx) => {
            const x = useEl.getAttribute('x') || '0'
            const y = useEl.getAttribute('y') || '0'
            const href = useEl.getAttribute('xlink:href') || useEl.getAttribute('href') || ''
            console.log(`  use[${idx}]: href="${href}", x=${x}, y=${y}`)
          })
          
          // MathJaxコンテナの追加情報
          const mjxContainer = svgElement.closest('mjx-container')
          if (mjxContainer) {
            const display = mjxContainer.getAttribute('display') || 'inline'
            const jax = mjxContainer.getAttribute('jax') || 'unknown'
            console.log(`📦 MathJaxコンテナ情報:`)
            console.log(`  display: ${display}`)
            console.log(`  jax: ${jax}`)
            console.log(`  class: ${mjxContainer.className}`)
          }
          
          // viewBoxからのベースライン推定（現在の方法）
          let mathBaseline = 0 // SVG下端からのベースライン位置
          let mathAscent = 0
          let mathDescent = 0
          
          if (svgViewBox) {
            const [vbX, vbY, vbWidth, vbHeight] = svgViewBox.split(' ').map(Number)
            
            console.log(`📐 viewBox詳細解析:`)
            console.log(`  vbX=${vbX} (左端位置)`)
            console.log(`  vbY=${vbY} (上端位置 - 負の場合はascent領域)`)
            console.log(`  vbWidth=${vbWidth} (viewBox幅)`)
            console.log(`  vbHeight=${vbHeight} (viewBox高さ)`)
            
            // 複数のベースライン推定方法を試行
            // 方法1: 現在の実装
            mathAscent = Math.abs(vbY)
            mathDescent = vbHeight - mathAscent
            const method1_baselineRatio = mathDescent / vbHeight
            const method1_baseline = svgHeight * method1_baselineRatio
            
            // 方法2: vbYが負の場合の別解釈
            const method2_baseline = vbY < 0 ? svgHeight + (vbY / vbHeight) * svgHeight : svgHeight * 0.75
            
            // 方法3: 固定比率（LaTeX標準のベースライン位置）
            const method3_baseline = svgHeight * 0.75 // 下端から25%の位置
            
            console.log(`🧮 ベースライン推定比較:`)
            console.log(`  方法1(現在): mathBaseline=${method1_baseline.toFixed(2)}px`)
            console.log(`  方法2(vbY考慮): mathBaseline=${method2_baseline.toFixed(2)}px`)
            console.log(`  方法3(固定75%): mathBaseline=${method3_baseline.toFixed(2)}px`)
            
            // とりあえず方法1を使用
            mathBaseline = method1_baseline
            
          } else {
            mathBaseline = svgHeight * 0.75
            console.log(`⚠️ viewBox無し - フォールバック: mathBaseline=${mathBaseline.toFixed(1)}px`)
          }
          
          console.log(`🎯 最終決定: mathBaseline=${mathBaseline.toFixed(2)}px`)
          console.log(`🔍 ==========================================`)
          
          console.log(`📊 SVG情報詳細:`)
          console.log(`  サイズ: ${widthAttr} → ${svgWidth.toFixed(1)}px`)
          console.log(`  高さ: ${heightAttr} → ${svgHeight.toFixed(1)}px`) 
          console.log(`  ex変換比率: ${exToPxRatio}`)
          console.log(`  ベースライン位置: ${mathBaseline.toFixed(1)}px (下端から)`)

          // 改行チェック
          if (currentX + svgWidth > maxWidth && currentX > 50) {
            currentX = 50
            currentY += lineHeight
            // ベースライン基準線も更新
            baselineLine = currentY
          }

          // ベースライン調整された数式描画
          const isDisplayMath = part.content.includes('$$') || part.content.includes('\\[')
          let mathY: number
          
          // ベースライン基準での描画位置計算
          // テキストのベースライン位置: baselineLine + textBaseline
          // 数式のベースライン位置: mathY + mathBaseline
          // これらを一致させる: mathY + mathBaseline = baselineLine + textBaseline
          // よって: mathY = baselineLine + textBaseline - mathBaseline
          
          const textBaselinePos = baselineLine + textBaseline
          mathY = textBaselinePos - mathBaseline
          
          console.log(`📐 ベースライン揃え計算:`)
          console.log(`  baselineLine=${baselineLine}`)
          console.log(`  textBaseline=${textBaseline}`)
          console.log(`  mathBaseline=${mathBaseline}`)
          console.log(`  `)
          console.log(`  計算過程:`)
          console.log(`    テキストのベースライン位置 = ${baselineLine} + ${textBaseline} = ${textBaselinePos}`)
          console.log(`    mathY = ${textBaselinePos} - ${mathBaseline} = ${mathY}`)
          console.log(`  `)
          console.log(`  検証計算:`)
          console.log(`    数式上端 = ${mathY}`)
          console.log(`    数式下端 = ${mathY} + ${svgHeight} = ${mathY + svgHeight}`)
          console.log(`    数式ベースライン = ${mathY} + ${mathBaseline} = ${mathY + mathBaseline}`)
          console.log(`  `)
          console.log(`  ⭐ 期待: 数式ベースライン(${mathY + mathBaseline}) = テキストベースライン(${textBaselinePos})`)
          console.log(`  ✅ 差分: ${Math.abs((mathY + mathBaseline) - textBaselinePos).toFixed(2)}px`)
          
          // 実験的ベースライン調整: SVG内のtext/use要素のy座標を活用
          let experimentalBaseline = mathBaseline
          
          // SVG内のtext/use要素からベースライン候補を抽出
          const baselineCandidates: number[] = []
          
          // text要素のy座標（これが実際の文字のベースライン位置）
          textElements.forEach((textEl) => {
            const y = parseFloat(textEl.getAttribute('y') || '0')
            if (y !== 0) {
              // viewBox座標系からSVG座標系へ変換
              const svgCoordY = svgHeight * (y / (svgViewBox ? parseFloat(svgViewBox.split(' ')[3]) : svgHeight))
              baselineCandidates.push(svgCoordY)
              console.log(`  text要素から推定: viewBox_y=${y} → svg_y=${svgCoordY.toFixed(2)}`)
            }
          })
          
          // use要素のy座標
          useElements.forEach((useEl) => {
            const y = parseFloat(useEl.getAttribute('y') || '0')
            if (y !== 0) {
              const svgCoordY = svgHeight * (y / (svgViewBox ? parseFloat(svgViewBox.split(' ')[3]) : svgHeight))
              baselineCandidates.push(svgCoordY)
              console.log(`  use要素から推定: viewBox_y=${y} → svg_y=${svgCoordY.toFixed(2)}`)
            }
          })
          
          // 最も妥当なベースライン候補を選択（中央値または最頻値）
          if (baselineCandidates.length > 0) {
            baselineCandidates.sort((a, b) => a - b)
            experimentalBaseline = baselineCandidates[Math.floor(baselineCandidates.length / 2)]
            console.log(`🧪 実験的ベースライン: ${experimentalBaseline.toFixed(2)}px (候補から選択)`)
          }
          
          // 複数のベースライン候補を視覚化
          ctx.save()
          const labelX = currentX + 300
          
          // 1. テキストベースライン（赤太）- 目標位置
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(currentX - 20, textBaselinePos)
          ctx.lineTo(currentX + svgWidth + 20, textBaselinePos)
          ctx.stroke()
          
          // 2. 現在の数式ベースライン（青）
          const currentMathBaselinePos = mathY + mathBaseline
          ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(currentX - 15, currentMathBaselinePos)
          ctx.lineTo(currentX + svgWidth + 15, currentMathBaselinePos)
          ctx.stroke()
          
          // 3. 実験的ベースライン（緑太）
          const experimentalMathY = textBaselinePos - experimentalBaseline
          const experimentalBaselinePos = experimentalMathY + experimentalBaseline
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(currentX - 15, experimentalBaselinePos)
          ctx.lineTo(currentX + svgWidth + 15, experimentalBaselinePos)
          ctx.stroke()
          
          // 4. 数式境界ボックス（現在の位置）
          ctx.strokeStyle = 'rgba(0, 0, 255, 0.3)'
          ctx.lineWidth = 1
          ctx.strokeRect(currentX, mathY, svgWidth, svgHeight)
          
          // 5. 実験的数式境界ボックス
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
          ctx.lineWidth = 2
          ctx.strokeRect(currentX, experimentalMathY, svgWidth, svgHeight)
          
          // ラベル表示
          ctx.font = '11px monospace'
          let labelY = Math.min(textBaselinePos, currentMathBaselinePos, experimentalBaselinePos) - 20
          const labelSpacing = 14
          
          ctx.fillStyle = 'red'
          ctx.fillText(`🔴 テキストBL: ${textBaselinePos.toFixed(1)}`, labelX, labelY)
          labelY += labelSpacing
          
          ctx.fillStyle = 'blue'
          ctx.fillText(`🔵 現在数式BL: ${currentMathBaselinePos.toFixed(1)}`, labelX, labelY)
          labelY += labelSpacing
          
          ctx.fillStyle = 'green'
          ctx.fillText(`🟢 実験BL: ${experimentalBaselinePos.toFixed(1)}`, labelX, labelY)
          labelY += labelSpacing
          
          // 成功判定
          const currentSuccess = Math.abs(currentMathBaselinePos - textBaselinePos) < 2
          const experimentalSuccess = Math.abs(experimentalBaselinePos - textBaselinePos) < 2
          
          ctx.fillStyle = currentSuccess ? 'blue' : 'gray'
          ctx.fillText(`現在方式: ${currentSuccess ? '✅' : '❌'}`, labelX, labelY)
          labelY += labelSpacing
          
          ctx.fillStyle = experimentalSuccess ? 'green' : 'gray'
          ctx.fillText(`実験方式: ${experimentalSuccess ? '✅' : '❌'}`, labelX, labelY)
          
          // より良い方式を採用
          if (experimentalSuccess && !currentSuccess) {
            mathY = experimentalMathY
            mathBaseline = experimentalBaseline
            console.log(`🎯 実験的ベースラインを採用: mathY=${mathY.toFixed(2)}, mathBaseline=${mathBaseline.toFixed(2)}`)
          }
          
          ctx.restore()
          
          const result = await renderSvgToImageAtPosition(svgElement, ctx, currentX, mathY, 1)
          
          console.log(`🧮 数式描画: "${part.content}" ${isDisplayMath ? '[Display]' : '[Inline]'} at (${currentX}, ${mathY})`)
          console.log(`  計算サイズ: ${svgWidth.toFixed(1)} x ${svgHeight.toFixed(1)}px`)
          console.log(`  実際サイズ: ${result.width} x ${result.height}px`)
          console.log(`  サイズ比率: W=${(result.width/svgWidth).toFixed(2)}x, H=${(result.height/svgHeight).toFixed(2)}x`)
          
          // サイズ比率が大きく違う場合は警告
          const widthRatio = result.width / svgWidth
          const heightRatio = result.height / svgHeight
          if (Math.abs(widthRatio - 1) > 0.5 || Math.abs(heightRatio - 1) > 0.5) {
            console.log(`  ⚠️ サイズ差異が大きいです。ex変換比率(${exToPxRatio})の調整が必要かもしれません`)
          } else {
            console.log(`  ✅ サイズ比率が適切です`)
          }
          
          currentX += result.width + 10 // スペースを追加

          // 大きな数式の場合は行の高さを調整
          if (result.height > lineHeight) {
            currentY += (result.height - lineHeight) / 2
            baselineLine = currentY
          }
        }

        // 行が長すぎる場合は改行
        if (currentX > maxWidth) {
          currentX = 50
          currentY += lineHeight
          baselineLine = currentY
        }
      }

      // 完了メッセージ
      const status = `✅ 統合表示完了: テキスト${textCount}個 + 数式${mathCount}個`
      setStatus(status)
      console.log(status)

    } catch (error) {
      setStatus(`❌ エラー: ${error}`)
      console.error('統合描画エラー:', error)
    }
  }, [])

  // コンポーネントマウント状態を追跡
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // MathJax初期化を待つヘルパー関数
  const waitForMathJax = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).MathJax && (window as any).mathJaxReady) {
        resolve(true)
        return
      }

      const handleMathJaxReady = () => {
        window.removeEventListener('mathjax-ready', handleMathJaxReady)
        resolve(true)
      }

      window.addEventListener('mathjax-ready', handleMathJaxReady)

      // 5秒後にタイムアウト
      const timeout = setTimeout(() => {
        window.removeEventListener('mathjax-ready', handleMathJaxReady)
        resolve(false)
      }, 5000)

      // 100ms間隔でチェック
      const checkReady = () => {
        if (typeof window !== 'undefined' && (window as any).MathJax && (window as any).mathJaxReady) {
          clearTimeout(timeout)
          window.removeEventListener('mathjax-ready', handleMathJaxReady)
          resolve(true)
        }
      }

      const interval = setInterval(checkReady, 100)
      setTimeout(() => clearInterval(interval), 5000)
    })
  }, [])

  // 初回レンダリング
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const initializeCanvas = async () => {
      const mathJaxReady = await waitForMathJax()
      
      if (mathJaxReady) {
        renderMathToCanvas(mathText)
      } else {
        setStatus('❌ MathJax初期化に失敗しました')
      }
    }

    initializeCanvas()
  }, [mathText, renderMathToCanvas, waitForMathJax])

  const testCases = [
    '文字 b b b \\( b \\) \\( \\dfrac{3}{2}b \\)',
    'ベースライン検証：\\( b \\) と \\( \\dfrac{3}{2}b \\) の b は揃う？',
    '分数は$\\frac{1}{2}$ と $\\frac{3}{4}$ と $\\frac{a}{b}$ できれい',
    '素晴らしい！$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\pi^2}{6}$$これでOK！',
    '積分計算：\\[ \\int_0^1 x^2 dx = \\frac{1}{3} \\] となる',
    'ギリシャ文字 \\( \\alpha + \\beta = \\gamma \\) を使用',
    'オイラーの公式 $e^{i\\pi} + 1 = 0$ は美しい',
    '簡単な $x^2$ の例',
    '半分は $\\frac{1}{2}$ ですね'
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">MathJax ベースライン揃えデバッグテスト</h1>
        <p className="text-gray-600">
          \\( b \\) と \\( \\dfrac{3}{2}b \\) の文字 b が同じベースラインに配置されるかテストします
        </p>
      </div>

      {/* 入力エリア */}
      <Card>
        <CardHeader>
          <CardTitle>数式入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={mathText}
            onChange={(e) => setMathText(e.target.value)}
            placeholder="MathJax記法で数式を入力してください..."
            rows={3}
            className="font-mono"
          />
          
          <Button 
            onClick={async () => {
              const mathJaxReady = await waitForMathJax()
              
              if (mathJaxReady) {
                renderMathToCanvas(mathText)
              } else {
                setStatus('❌ MathJaxが初期化されていません')
              }
            }}
            className="w-full"
          >
            プレビュー更新
          </Button>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {testCases.map((testCase, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={async () => {
                  setMathText(testCase)
                  
                  const mathJaxReady = await waitForMathJax()
                  if (mathJaxReady) {
                    setTimeout(() => renderMathToCanvas(testCase), 100)
                  } else {
                    setStatus('❌ MathJaxが初期化されていません')
                  }
                }}
                className="text-left justify-start font-mono text-xs"
              >
                {isMounted ? (
                  testCase.length > 20 ? testCase.substring(0, 20) + '...' : testCase
                ) : (
                  `テストケース${index + 1}`
                )}
              </Button>
            ))}
          </div>

          {status && (
            <div className="p-2 bg-gray-100 rounded-md">
              <p className="text-sm">{status}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canvas描画結果 */}
      <Card>
        <CardHeader>
          <CardTitle>Canvas描画結果</CardTitle>
        </CardHeader>
        <CardContent>
          <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="border border-gray-300 bg-white w-full"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </CardContent>
      </Card>
    </div>
  )
}