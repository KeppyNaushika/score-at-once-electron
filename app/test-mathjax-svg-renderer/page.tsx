"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RichTextEditorModal } from "@/components/projects/07-score-at-once/ScoringIndividual/RichTextEditorModal"
import { renderMarkdownToCanvas } from "@/components/projects/07-score-at-once/ScoringIndividual/utils/canvasTextRendererHybrid"

// シンプルなテキスト要素の型定義
interface TextElement {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  fontSize: number
  renderedCanvas?: HTMLCanvasElement | null
}

// シンプルな描画ツール型
type DrawingTool = "hand" | "text"

// テストページのメインコンポーネント
export default function MathJaxSVGRendererTest() {
  // Canvas と画像の参照
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 描画状態
  const [currentTool, setCurrentTool] = useState<DrawingTool>("text")
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null)
  const [strokeColor, setStrokeColor] = useState("#ff0000")
  
  // テキスト入力モーダル状態
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInputValue, setTextInputValue] = useState("")
  const [currentTextBox, setCurrentTextBox] = useState<{
    x: number, y: number, width: number, height: number
  } | null>(null)
  
  // サンプル画像（答案の代替）
  const [sampleImage, setSampleImage] = useState<HTMLImageElement | null>(null)
  
  // LaTeX記法をMarkdown記法に変換
  const convertLatexToMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\\\(/g, '$')     // \( を $ に
      .replace(/\\\)/g, '$')     // \) を $ に
      .replace(/\\\[/g, '$$')    // \[ を $$ に
      .replace(/\\\]/g, '$$')    // \] を $$ に
  }, [])
  
  // テキストをMathJax SVGとしてレンダリング
  const renderTextElement = useCallback(async (element: TextElement) => {
    try {
      const processedText = convertLatexToMarkdown(element.text)
      const result = await renderMarkdownToCanvas({
        text: processedText,
        color: element.color,
        fontSize: element.fontSize,
        maxWidth: element.width,
        maxHeight: element.height,
        backgroundColor: 'transparent'
      })
      
      return result.canvas
    } catch (error) {
      console.error('テキストレンダリングエラー:', error)
      return null
    }
  }, [convertLatexToMarkdown])

  // サンプル画像を作成
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setSampleImage(img)
      drawCanvas()
    }
    // シンプルなサンプル画像（Data URL）
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f8f9fa'/%3E%3Ctext x='400' y='50' text-anchor='middle' font-family='Arial' font-size='24' fill='%23333'%3E数学テスト問題%3C/text%3E%3Ctext x='50' y='120' font-family='Arial' font-size='18' fill='%23666'%3E問題1: 次の式を計算せよ%3C/text%3E%3Ctext x='50' y='160' font-family='Arial' font-size='16' fill='%23333'%3E∫(x² + 2x + 1)dx = ?%3C/text%3E%3Cline x1='50' y1='200' x2='750' y2='200' stroke='%23ccc' stroke-width='1'/%3E%3Ctext x='50' y='280' font-family='Arial' font-size='18' fill='%23666'%3E問題2: 以下の極限値を求めよ%3C/text%3E%3Ctext x='50' y='320' font-family='Arial' font-size='16' fill='%23333'%3Elim(x→0) sin(x)/x = ?%3C/text%3E%3Cline x1='50' y1='360' x2='750' y2='360' stroke='%23ccc' stroke-width='1'/%3E%3C/svg%3E"
  }, [])

  // Canvas描画処理
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // サンプル画像を描画
    if (sampleImage) {
      ctx.drawImage(sampleImage, 0, 0, canvas.width, canvas.height)
    }

    // ドラッグ中の矩形を描画
    if (isDrawing && dragStart && dragEnd) {
      const x = Math.min(dragStart.x, dragEnd.x)
      const y = Math.min(dragStart.y, dragEnd.y)
      const width = Math.abs(dragEnd.x - dragStart.x)
      const height = Math.abs(dragEnd.y - dragStart.y)

      ctx.strokeStyle = "#2563eb"
      ctx.setLineDash([5, 5])
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)
      ctx.fillStyle = "rgba(37, 99, 235, 0.1)"
      ctx.fillRect(x, y, width, height)
      ctx.setLineDash([])
    }

    // テキスト要素を描画（実際のMathJax SVG）
    textElements.forEach((element) => {
      // テキストボックスの枠を描画
      ctx.strokeStyle = element.color
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.strokeRect(element.x, element.y, element.width, element.height)
      ctx.setLineDash([])
      
      // 実際にレンダリングされたMathJax SVGキャンバスを描画
      if (element.renderedCanvas) {
        // 中央揃えで描画
        const offsetX = (element.width - element.renderedCanvas.width) / 2
        const offsetY = (element.height - element.renderedCanvas.height) / 2
        
        ctx.drawImage(
          element.renderedCanvas,
          element.x + Math.max(0, offsetX),
          element.y + Math.max(0, offsetY)
        )
      } else {
        // まだレンダリングされていない場合はローディング表示
        ctx.fillStyle = '#888'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          'レンダリング中...',
          element.x + element.width / 2,
          element.y + element.height / 2
        )
      }
    })
  }, [sampleImage, textElements, isDrawing, dragStart, dragEnd])

  // Canvas再描画
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // マウスイベントハンドラー
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (currentTool === "text") {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      setIsDrawing(true)
      setDragStart({ x, y })
      setDragEnd({ x, y })
    }
  }, [currentTool])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !dragStart) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setDragEnd({ x, y })
    drawCanvas()
  }, [isDrawing, dragStart, drawCanvas])

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !dragStart || !dragEnd) return

    const x = Math.min(dragStart.x, dragEnd.x)
    const y = Math.min(dragStart.y, dragEnd.y)
    const width = Math.abs(dragEnd.x - dragStart.x)
    const height = Math.abs(dragEnd.y - dragStart.y)

    // 最小サイズのチェック
    if (width > 30 && height > 20) {
      setCurrentTextBox({ x, y, width, height })
      setShowTextInput(true)
    }

    setIsDrawing(false)
    setDragStart(null)
    setDragEnd(null)
    drawCanvas()
  }, [isDrawing, dragStart, dragEnd, drawCanvas])

  // テキスト送信処理
  const handleTextSubmit = useCallback(async () => {
    if (!textInputValue.trim() || !currentTextBox) {
      setShowTextInput(false)
      setTextInputValue("")
      setCurrentTextBox(null)
      return
    }

    const newElement: TextElement = {
      id: Date.now().toString(),
      x: currentTextBox.x,
      y: currentTextBox.y,
      width: currentTextBox.width,
      height: currentTextBox.height,
      text: textInputValue,
      color: strokeColor,
      fontSize: 16,
      renderedCanvas: null
    }

    // テキスト要素を追加（レンダリング前）
    setTextElements(prev => [...prev, newElement])
    setShowTextInput(false)
    setTextInputValue("")
    setCurrentTextBox(null)
    
    // 非同期でMathJax SVGレンダリングを実行
    try {
      const renderedCanvas = await renderTextElement(newElement)
      
      // レンダリング完了後に要素を更新
      setTextElements(prev => 
        prev.map(element => 
          element.id === newElement.id 
            ? { ...element, renderedCanvas }
            : element
        )
      )
    } catch (error) {
      console.error('テキストレンダリング失敗:', error)
      // エラー時は要素を削除するかエラー表示
      setTextElements(prev => 
        prev.filter(element => element.id !== newElement.id)
      )
    }
  }, [textInputValue, currentTextBox, strokeColor, renderTextElement])

  // テキストキャンセル処理
  const handleTextCancel = useCallback(() => {
    setShowTextInput(false)
    setTextInputValue("")
    setCurrentTextBox(null)
  }, [])

  // クリア処理
  const handleClear = useCallback(() => {
    setTextElements([])
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="border-b bg-white p-4">
        <h1 className="text-2xl font-bold text-gray-800">MathJax SVG描画テスト</h1>
        <p className="text-gray-600 mt-2">
          キャンバス上でドラッグしてテキストボックスを作成し、MathJax記法でテキストを入力できます
        </p>
      </div>

      {/* ツールバー */}
      <div className="border-b bg-white p-4 flex items-center space-x-4">
        <Button
          variant={currentTool === "hand" ? "default" : "outline"}
          onClick={() => setCurrentTool("hand")}
        >
          👋 ハンドツール
        </Button>
        <Button
          variant={currentTool === "text" ? "default" : "outline"}
          onClick={() => setCurrentTool("text")}
        >
          📝 テキストツール
        </Button>
        
        {/* カラーピッカー */}
        <div className="flex items-center space-x-2">
          <label htmlFor="color-picker" className="text-sm">色:</label>
          <input
            id="color-picker"
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-8 h-8 border rounded"
          />
        </div>

        <Button onClick={handleClear} variant="destructive">
          🗑️ クリア
        </Button>
      </div>

      {/* キャンバスエリア */}
      <div className="flex-1 p-4 overflow-auto">
        <div
          ref={containerRef}
          className="max-w-fit mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="block cursor-crosshair"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            style={{
              cursor: currentTool === "hand" ? "grab" : "crosshair"
            }}
          />
        </div>
      </div>

      {/* 情報パネル */}
      <div className="border-t bg-white p-4">
        <div className="text-sm text-gray-600">
          <p><strong>使い方:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>テキストツールを選択してキャンバス上でドラッグしてテキストボックスを作成</li>
            <li>モーダルでMathJax記法を使って数式やテキストを入力</li>
            <li>SVG描画されたテキストがキャンバス上に表示されます</li>
          </ul>
          
          <div className="mt-3">
            <p><strong>MathJax記法の例:</strong></p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div>
                <code className="bg-gray-100 px-1 rounded">$x^2 + y^2 = r^2$</code>
                <div className="text-gray-500">インライン数式</div>
              </div>
              <div>
                <code className="bg-gray-100 px-1 rounded">$$\int_0^1 f(x)dx$$</code>
                <div className="text-gray-500">ブロック数式</div>
              </div>
              <div>
                <code className="bg-gray-100 px-1 rounded">\(sin(\theta)\)</code>
                <div className="text-gray-500">LaTeX記法</div>
              </div>
              <div>
                <code className="bg-gray-100 px-1 rounded">**太字** *斜体*</code>
                <div className="text-gray-500">Markdown記法</div>
              </div>
            </div>
          </div>
          
          <p className="mt-3">現在のテキスト要素数: {textElements.length}</p>
          {textElements.filter(e => !e.renderedCanvas).length > 0 && (
            <p className="text-amber-600">
              レンダリング待ち: {textElements.filter(e => !e.renderedCanvas).length}件
            </p>
          )}
        </div>
      </div>

      {/* テキスト入力モーダル */}
      <RichTextEditorModal
        open={showTextInput}
        onOpenChange={setShowTextInput}
        value={textInputValue}
        onValueChange={setTextInputValue}
        color={strokeColor}
        onColorChange={setStrokeColor}
        onSubmit={handleTextSubmit}
        onCancel={handleTextCancel}
        title="テキスト入力 - MathJax記法対応"
      />
    </div>
  )
}