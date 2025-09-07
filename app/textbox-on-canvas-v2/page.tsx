"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface TextBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  isSelected: boolean
}

export default function TextboxCanvasV2Page() {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(
    null,
  )
  const [isCreating, setIsCreating] = useState(false)
  const [createStart, setCreateStart] = useState<{
    x: number
    y: number
  } | null>(null)
  const [currentCreate, setCurrentCreate] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [zoom, setZoom] = useState(1)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // MathJax処理関数
  const processMathJax = useCallback(async (container: HTMLElement): Promise<void> => {
    const MathJax = (window as any).MathJax
    
    if (!MathJax || !MathJax.typesetPromise) {
      console.warn('⚠️ MathJax is not available')
      return
    }

    try {
      console.log('🧮 MathJax処理開始:', { 
        mathJaxExists: !!MathJax, 
        typesetExists: !!MathJax.typesetPromise,
        containerHTML: container.innerHTML.substring(0, 100)
      })
      
      await MathJax.typesetPromise([container])
      
      console.log('✅ MathJax処理完了:', container.innerHTML.substring(0, 100))
    } catch (error) {
      console.error('❌ MathJax処理エラー:', error)
      // MathJax処理失敗時も継続
    }
  }, [])

  // 描画完了待機関数
  const waitForRenderingComplete = useCallback(async (frames: number = 2): Promise<void> => {
    for (let i = 0; i < frames; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
  }, [])

  const SAMPLE_IMAGE_URL =
    "data:image/svg+xml," +
    encodeURIComponent(`
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
        <text x="400" y="50" text-anchor="middle" font-size="24" font-family="Arial" fill="#495057">
          テキストボックステスト用キャンバス（V2 - ScrollWidth専用）
        </text>
        <text x="400" y="100" text-anchor="middle" font-size="16" font-family="Arial" fill="#6c757d">
          ドラッグしてテキストボックスを作成してください
        </text>
        <line x1="50" y1="150" x2="750" y2="150" stroke="#dee2e6" stroke-width="1"/>
        <line x1="50" y1="300" x2="750" y2="300" stroke="#dee2e6" stroke-width="1"/>
        <line x1="50" y1="450" x2="750" y2="450" stroke="#dee2e6" stroke-width="1"/>
        <line x1="200" y1="120" x2="200" y2="580" stroke="#dee2e6" stroke-width="1"/>
        <line x1="400" y1="120" x2="400" y2="580" stroke="#dee2e6" stroke-width="1"/>
        <line x1="600" y1="120" x2="600" y2="580" stroke="#dee2e6" stroke-width="1"/>
      </svg>
    `)

  // Canvas座標変換
  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 }
      const rect = canvasRef.current.getBoundingClientRect()
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      }
    },
    [zoom],
  )

  // ScrollWidth/ScrollHeightによる測定とSVG生成（元コード移植版）
  const measureContentSize = useCallback(
    async (htmlContent: string): Promise<{ width: number; height: number; svgElement: SVGSVGElement | null }> => {
      const tempDiv = document.createElement("div")
      tempDiv.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      font-size: 24px;
      line-height: 1;
      color: #000000;
      visibility: hidden;
      width: max-content;
      height: max-content;
      min-width: 0;
      min-height: 0;
      padding: 0;
      margin: 0;
      border: 0;
    `
      tempDiv.innerHTML = htmlContent
      document.body.appendChild(tempDiv)

      let measuredSize = { width: 20, height: 20 }
      let svgElement: SVGSVGElement | null = null

      try {
        // MathJax処理完了まで待機
        await processMathJax(tempDiv)
        await waitForRenderingComplete(2)

        // ScrollWidth/ScrollHeightのみで測定
        measuredSize = {
          width: Math.max(20, tempDiv.scrollWidth),
          height: Math.max(20, tempDiv.scrollHeight),
        }

        // MathJax処理後のHTMLからSVGを生成（処理済みHTMLを直接使用）
        const processedHTML = tempDiv.innerHTML
        
        const svgString = `
          <svg xmlns="http://www.w3.org/2000/svg" 
               width="${measuredSize.width}" 
               height="${measuredSize.height}" 
               viewBox="0 0 ${measuredSize.width} ${measuredSize.height}">
            <foreignObject x="0" y="0" 
                           width="${measuredSize.width}" 
                           height="${measuredSize.height}">
              <div xmlns="http://www.w3.org/1999/xhtml" 
                   style="font-size: 24px; line-height: 1; color: #000000; margin: 0; padding: 0;">
                ${processedHTML}
              </div>
            </foreignObject>
          </svg>
        `

        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
        svgElement = svgDoc.documentElement as unknown as SVGSVGElement

        // デバッグ情報を表示
        const debugDisplay = document.getElementById("scroll-debug-display")
        if (debugDisplay) {
          debugDisplay.innerHTML = `
          <div class="bg-blue-50 p-2 rounded border border-blue-200">
            <div class="font-medium text-blue-700 mb-1">📏 ScrollWidth/Height測定</div>
            <div class="text-sm">
              <div>scrollWidth: ${tempDiv.scrollWidth}px</div>
              <div>scrollHeight: ${tempDiv.scrollHeight}px</div>
              <div>最終サイズ: <span class="font-bold text-blue-800">${measuredSize.width} × ${measuredSize.height}px</span></div>
              <div>SVG生成: ${svgElement ? '成功' : '失敗'}</div>
            </div>
          </div>
        `
        }
      } catch (error) {
        console.error("測定エラー:", error)
      } finally {
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv)
        }
      }

      return { ...measuredSize, svgElement }
    },
    [processMathJax, waitForRenderingComplete],
  )

  // Canvas描画
  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // キャンバスクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 背景画像描画
    const img = new Image()
    img.onload = async () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // テキストボックス描画
      for (const textBox of textBoxes) {
        // テキストボックス枠
        ctx.strokeStyle = textBox.isSelected ? "#2563eb" : "#6b7280"
        ctx.lineWidth = textBox.isSelected ? 2 : 1
        ctx.strokeRect(textBox.x, textBox.y, textBox.width, textBox.height)

        if (textBox.isSelected) {
          ctx.fillStyle = "rgba(37, 99, 235, 0.1)"
          ctx.fillRect(textBox.x, textBox.y, textBox.width, textBox.height)
        }

        // テキスト内容がある場合、赤枠（実測サイズ）を描画
        if (textBox.text.trim()) {
          try {
            const result = await measureContentSize(textBox.text)

            // 赤枠描画
            ctx.save()
            ctx.strokeStyle = "red"
            ctx.lineWidth = 1
            ctx.strokeRect(
              textBox.x,
              textBox.y,
              result.width,
              result.height,
            )

            // SVGをCanvas上に描画
            if (result.svgElement) {
              try {
                // SVGを完全な文字列として再構築
                const svgData = new XMLSerializer().serializeToString(result.svgElement)
                
                // SVGに必要なCSSスタイルを追加
                const fullSvgData = svgData.replace(
                  '<foreignObject',
                  `<defs>
                    <style type="text/css">
                      mjx-container[jax="SVG"] > svg { overflow: visible !important; }
                      mjx-container svg { overflow: visible !important; }
                      .MJXc-display { margin: 0 !important; }
                    </style>
                  </defs>
                  <foreignObject`
                )
                
                const svgBlob = new Blob([fullSvgData], {
                  type: 'image/svg+xml;charset=utf-8'
                })
                const svgUrl = URL.createObjectURL(svgBlob)
                
                const img = new Image()
                img.crossOrigin = 'anonymous'
                
                img.onload = () => {
                  try {
                    // Canvas描画
                    ctx.save()
                    ctx.drawImage(
                      img,
                      textBox.x,
                      textBox.y,
                      result.width,
                      result.height
                    )
                    ctx.restore()
                  } catch (drawError) {
                    console.error('Canvas描画エラー:', drawError)
                  }
                  URL.revokeObjectURL(svgUrl)
                }

                img.onerror = (error) => {
                  console.error('SVG画像読み込みエラー:', error)
                  URL.revokeObjectURL(svgUrl)
                  
                  // フォールバック: プレーンテキスト描画
                  ctx.fillStyle = "#000000"
                  ctx.font = "24px Arial"
                  ctx.textBaseline = "top"
                  ctx.fillText(textBox.text, textBox.x + 5, textBox.y + 5)
                }

                img.src = svgUrl
                
              } catch (svgError) {
                console.error('SVG変換エラー:', svgError)
                // フォールバック: プレーンテキスト描画
                ctx.fillStyle = "#000000"
                ctx.font = "24px Arial"
                ctx.textBaseline = "top"
                ctx.fillText(textBox.text, textBox.x + 5, textBox.y + 5)
              }
            } else {
              // SVG生成失敗時のフォールバック
              ctx.fillStyle = "#000000"
              ctx.font = "24px Arial"
              ctx.textBaseline = "top"
              ctx.fillText(textBox.text, textBox.x + 5, textBox.y + 5)
            }

            // 赤枠サイズ表示をDIVに
            const redBorderDisplay =
              document.getElementById("red-border-display")
            if (redBorderDisplay) {
              redBorderDisplay.innerHTML = `
                <div class="bg-red-50 p-2 rounded border border-red-200">
                  <div class="font-medium text-red-700 mb-1">🔴 実際の赤枠サイズ</div>
                  <div class="text-sm">
                    <div>位置: (${Math.round(textBox.x)}, ${Math.round(textBox.y)})</div>
                    <div>サイズ: <span class="font-bold text-red-800">${result.width} × ${result.height}px</span></div>
                  </div>
                </div>
              `
            }

            ctx.restore()
          } catch (error) {
            console.error("テキスト測定エラー:", error)
          }
        }
      }

      // 作成中の枠を描画
      if (currentCreate) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(
          currentCreate.x,
          currentCreate.y,
          currentCreate.width,
          currentCreate.height,
        )
        ctx.setLineDash([])
      }
    }
    img.src = SAMPLE_IMAGE_URL
  }, [textBoxes, currentCreate, measureContentSize])

  // テキスト更新
  const updateTextBoxText = useCallback((id: string, newText: string) => {
    setTextBoxes((prev) =>
      prev.map((box) => (box.id === id ? { ...box, text: newText } : box)),
    )
  }, [])

  // マウスイベント
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoordinates(e.clientX, e.clientY)

      // 既存のテキストボックスをクリックしたかチェック
      const clickedBox = textBoxes.find(
        (box) =>
          coords.x >= box.x &&
          coords.x <= box.x + box.width &&
          coords.y >= box.y &&
          coords.y <= box.y + box.height,
      )

      if (clickedBox) {
        // テキストボックス選択
        setTextBoxes((prev) =>
          prev.map((box) => ({ ...box, isSelected: box.id === clickedBox.id })),
        )
        setSelectedTextBoxId(clickedBox.id)
      } else {
        // 新しいテキストボックス作成開始
        setTextBoxes((prev) =>
          prev.map((box) => ({ ...box, isSelected: false })),
        )
        setSelectedTextBoxId(null)
        setIsCreating(true)
        setCreateStart(coords)
        setCurrentCreate({ x: coords.x, y: coords.y, width: 0, height: 0 })
      }
    },
    [getCanvasCoordinates, textBoxes],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isCreating || !createStart) return

      const coords = getCanvasCoordinates(e.clientX, e.clientY)
      const width = Math.abs(coords.x - createStart.x)
      const height = Math.abs(coords.y - createStart.y)
      const x = Math.min(coords.x, createStart.x)
      const y = Math.min(coords.y, createStart.y)

      setCurrentCreate({ x, y, width, height })
    },
    [isCreating, createStart, getCanvasCoordinates],
  )

  const handleMouseUp = useCallback(() => {
    if (
      isCreating &&
      currentCreate &&
      currentCreate.width > 5 &&
      currentCreate.height > 5
    ) {
      const newBox: TextBox = {
        id: `textbox-${Date.now()}`,
        x: currentCreate.x,
        y: currentCreate.y,
        width: currentCreate.width,
        height: currentCreate.height,
        text: "",
        isSelected: true,
      }
      setTextBoxes((prev) => [...prev, newBox])
      setSelectedTextBoxId(newBox.id)
    }

    setIsCreating(false)
    setCreateStart(null)
    setCurrentCreate(null)
  }, [isCreating, currentCreate])

  // Canvas再描画
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const selectedTextBox = textBoxes.find((box) => box.id === selectedTextBoxId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              テキストボックス Canvas (ズーム: {Math.round(zoom * 100)}%)
            </h1>
            <p className="text-gray-600">V2 - ScrollWidth/ScrollHeight専用版</p>
            <div className="mt-2 text-sm text-blue-600">
              ドラッグしてテキストボックスを作成し、ダブルクリックでテキストを編集できます。MathJax数式をサポートしています。
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-lg">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border-2 border-dashed border-gray-300">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="h-auto w-full cursor-crosshair"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>

              {/* Element Information List */}
              <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-600">
                <div className="mb-2 font-medium">
                  要素情報リスト ({textBoxes.length}個)
                </div>
                {textBoxes.length === 0 ? (
                  <div className="text-gray-400 italic">
                    テキストボックスが作成されていません
                  </div>
                ) : (
                  <div className="space-y-1">
                    {textBoxes.map((textBox) => (
                      <div
                        key={textBox.id}
                        className={`flex items-center justify-between rounded p-2 ${
                          textBox.isSelected
                            ? "border border-blue-200 bg-blue-100"
                            : "border border-gray-200 bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 font-mono text-xs text-gray-500">
                            ID: {textBox.id.substring(0, 8)}...
                          </div>
                          <div className="text-xs">
                            <span className="mr-3 inline-block">
                              位置: ({Math.round(textBox.x)},{" "}
                              {Math.round(textBox.y)})
                            </span>
                            <span className="inline-block">
                              サイズ: {Math.round(textBox.width)} ×{" "}
                              {Math.round(textBox.height)}
                            </span>
                          </div>
                          {textBox.text && (
                            <div className="mt-1 truncate text-xs text-gray-700">
                              内容: {textBox.text.substring(0, 50)}
                              {textBox.text.length > 50 ? "..." : ""}
                            </div>
                          )}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {textBox.isSelected && (
                            <span className="rounded bg-blue-500 px-2 py-1 text-xs text-white">
                              選択中
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Red Border Debug Information */}
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-gray-600">
                <div className="mb-2 font-medium">🔴 赤枠サイズ情報</div>
                <div id="red-border-display" className="space-y-2">
                  <div className="text-gray-400 italic">
                    テキストボックスにテキストを入力すると赤枠サイズが表示されます
                  </div>
                </div>
              </div>

              {/* ScrollWidth Debug Information */}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-gray-600">
                <div className="mb-2 font-medium">
                  📏 ScrollWidth/Height測定詳細
                </div>
                <div id="scroll-debug-display" className="space-y-2">
                  <div className="text-gray-400 italic">
                    テキストボックスを作成・編集すると測定データが表示されます
                  </div>
                </div>
              </div>

              {/* コントロールパネル */}
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setZoom((prev) => Math.min(prev + 0.1, 2))}
                  variant="outline"
                  size="sm"
                >
                  ズームイン
                </Button>
                <Button
                  onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.3))}
                  variant="outline"
                  size="sm"
                >
                  ズームアウト
                </Button>
                <Button onClick={() => setZoom(1)} variant="outline" size="sm">
                  リセット
                </Button>
                <div className="text-sm text-gray-600">
                  テキストボックス数: {textBoxes.length}
                </div>
              </div>

              {/* テキスト編集エリア */}
              {selectedTextBox && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="textbox-content"
                        className="text-sm font-medium"
                      >
                        テキストボックス内容 (ID:{" "}
                        {selectedTextBox.id.substring(0, 8)}...)
                      </Label>
                      <div className="text-xs text-gray-600">
                        位置: ({Math.round(selectedTextBox.x)},{" "}
                        {Math.round(selectedTextBox.y)}) | サイズ:{" "}
                        {Math.round(selectedTextBox.width)} ×{" "}
                        {Math.round(selectedTextBox.height)}
                      </div>
                    </div>
                    <Textarea
                      id="textbox-content"
                      value={selectedTextBox.text}
                      onChange={(e) =>
                        updateTextBoxText(selectedTextBox.id, e.target.value)
                      }
                      placeholder="テキストを入力してください。MathJax記法 ($x^2$, $$\frac{a}{b}$$) がサポートされています。"
                      className="min-h-[100px] font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
