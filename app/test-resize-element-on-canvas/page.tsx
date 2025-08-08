'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface Rectangle {
  x: number        // 0.0 - 1.0 (normalized)
  y: number        // 0.0 - 1.0 (normalized)  
  width: number    // 0.0 - 1.0 (normalized)
  height: number   // 0.0 - 1.0 (normalized)
  color: string
}

interface DragState {
  isDragging: boolean
  isResizing: boolean
  dragOffset: { x: number; y: number }  // normalized coordinates
  resizeHandle: string | null
  startBounds: Rectangle | null
  capturedPointerId: number | null
}

export default function TestResizeElementOnCanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // 初期状態で長方形を描画（正規化座標 0.0-1.0）
  const [rectangle, setRectangle] = useState<Rectangle>({
    x: 0.2,        // 20% from left
    y: 0.25,       // 25% from top  
    width: 0.3,    // 30% width
    height: 0.35,  // 35% height
    color: '#3b82f6'
  })

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    resizeHandle: null,
    startBounds: null,
    capturedPointerId: null
  })

  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]) // 最新20件
  }, [])

  // 座標変換関数（正規化座標 ↔ スクリーン座標）
  const normalizedToScreen = useCallback((normalizedX: number, normalizedY: number, canvas: HTMLCanvasElement) => {
    return {
      x: normalizedX * canvas.width,
      y: normalizedY * canvas.height
    }
  }, [])

  const screenToNormalized = useCallback((screenX: number, screenY: number, canvas: HTMLCanvasElement) => {
    return {
      x: screenX / canvas.width,
      y: screenY / canvas.height
    }
  }, [])

  // 負値の幅・高さを正規化（座標入れ替え）
  const normalizeNegativeDimensions = useCallback((x: number, y: number, width: number, height: number) => {
    let normalizedX = x
    let normalizedY = y
    let normalizedWidth = width
    let normalizedHeight = height
    
    // 負の幅の場合：左右を入れ替え
    if (width < 0) {
      normalizedX = x + width  // 左端を右端に移動
      normalizedWidth = Math.abs(width)  // 絶対値に
      addDebugLog(`🔄 Width negative: flipping x from ${x.toFixed(3)} to ${normalizedX.toFixed(3)}, width: ${width.toFixed(3)} → ${normalizedWidth.toFixed(3)}`)
    }
    
    // 負の高さの場合：上下を入れ替え
    if (height < 0) {
      normalizedY = y + height  // 上端を下端に移動
      normalizedHeight = Math.abs(height)  // 絶対値に
      addDebugLog(`🔄 Height negative: flipping y from ${y.toFixed(3)} to ${normalizedY.toFixed(3)}, height: ${height.toFixed(3)} → ${normalizedHeight.toFixed(3)}`)
    }
    
    return {
      x: normalizedX,
      y: normalizedY,
      width: normalizedWidth,
      height: normalizedHeight
    }
  }, [addDebugLog])

  // 正規化座標での境界制限
  const clampNormalized = useCallback((x: number, y: number, width: number, height: number) => {
    // まず負値を正規化（座標入れ替え）
    const normalized = normalizeNegativeDimensions(x, y, width, height)
    
    // 座標を0-1範囲にクランプ
    const clampedX = Math.max(0, Math.min(1, normalized.x))
    const clampedY = Math.max(0, Math.min(1, normalized.y))
    
    // サイズを制限（座標+サイズが1を超えないように）
    const maxWidth = 1 - clampedX
    const maxHeight = 1 - clampedY
    const clampedWidth = Math.max(0.01, Math.min(maxWidth, normalized.width))  // 最小1%
    const clampedHeight = Math.max(0.01, Math.min(maxHeight, normalized.height)) // 最小1%
    
    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight
    }
  }, [normalizeNegativeDimensions])

  // キャンバス描画（正規化座標をスクリーン座標に変換して描画）
  const draw = useCallback((ctx: CanvasRenderingContext2D, rect: Rectangle) => {
    const canvas = ctx.canvas
    
    // 正規化座標をスクリーン座標に変換
    const screenPos = normalizedToScreen(rect.x, rect.y, canvas)
    const screenSize = {
      width: rect.width * canvas.width,
      height: rect.height * canvas.height
    }
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // 背景を描画
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 長方形を描画
    ctx.fillStyle = rect.color
    ctx.fillRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height)
    
    // 枠線を描画
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 2
    ctx.strokeRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height)
    
    // リサイズハンドルを描画（正規化座標）
    const handleSizeNormalized = 8 / canvas.width  // ハンドルサイズを正規化
    const handles = [
      { x: rect.x, y: rect.y, name: 'top-left' },
      { x: rect.x + rect.width, y: rect.y, name: 'top-right' },
      { x: rect.x, y: rect.y + rect.height, name: 'bottom-left' },
      { x: rect.x + rect.width, y: rect.y + rect.height, name: 'bottom-right' }
    ]
    
    ctx.fillStyle = '#ef4444'
    handles.forEach(handle => {
      const handleScreen = normalizedToScreen(handle.x, handle.y, canvas)
      const handleSizeScreen = handleSizeNormalized * canvas.width
      ctx.fillRect(
        handleScreen.x - handleSizeScreen / 2, 
        handleScreen.y - handleSizeScreen / 2, 
        handleSizeScreen, 
        handleSizeScreen
      )
    })
    
    // キャンバス境界線を描画
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
    
    // 正規化座標のグリッドを表示（デバッグ用）
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * canvas.width
      const y = (i / 10) * canvas.height
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    
  }, [normalizedToScreen])

  // リサイズハンドルの判定（正規化座標）
  const getResizeHandle = useCallback((normalizedX: number, normalizedY: number, rect: Rectangle, canvas: HTMLCanvasElement): string | null => {
    const handleSizeNormalized = 8 / canvas.width  // ハンドルサイズを正規化
    const tolerance = handleSizeNormalized / 2
    
    const handles = [
      { x: rect.x, y: rect.y, name: 'top-left' },
      { x: rect.x + rect.width, y: rect.y, name: 'top-right' },
      { x: rect.x, y: rect.y + rect.height, name: 'bottom-left' },
      { x: rect.x + rect.width, y: rect.y + rect.height, name: 'bottom-right' }
    ]
    
    for (const handle of handles) {
      if (Math.abs(normalizedX - handle.x) <= tolerance && Math.abs(normalizedY - handle.y) <= tolerance) {
        return handle.name
      }
    }
    
    return null
  }, [])

  // 長方形内かどうかの判定（正規化座標）
  const isInsideRectangle = useCallback((normalizedX: number, normalizedY: number, rect: Rectangle): boolean => {
    return normalizedX >= rect.x && normalizedX <= rect.x + rect.width && 
           normalizedY >= rect.y && normalizedY <= rect.y + rect.height
  }, [])

  // リサイズ処理（正規化座標）
  const handleResize = useCallback((
    normalizedX: number, 
    normalizedY: number, 
    handle: string, 
    startBounds: Rectangle
  ): Rectangle => {
    let newRect = { ...startBounds }
    
    // マウス座標を0-1にクランプしてからwidth/height計算
    const clampedMouseX = Math.max(0, Math.min(1, normalizedX))
    const clampedMouseY = Math.max(0, Math.min(1, normalizedY))
    
    addDebugLog(`🔧 Resize: handle=${handle}, mouse(${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)}) → clamped(${clampedMouseX.toFixed(3)}, ${clampedMouseY.toFixed(3)})`)
    
    switch (handle) {
      case 'top-left':
        newRect.width = startBounds.x + startBounds.width - clampedMouseX
        newRect.height = startBounds.y + startBounds.height - clampedMouseY
        newRect.x = clampedMouseX
        newRect.y = clampedMouseY
        break
      case 'top-right':
        newRect.width = clampedMouseX - startBounds.x
        newRect.height = startBounds.y + startBounds.height - clampedMouseY
        newRect.y = clampedMouseY
        break
      case 'bottom-left':
        newRect.width = startBounds.x + startBounds.width - clampedMouseX
        newRect.height = clampedMouseY - startBounds.y
        newRect.x = clampedMouseX
        break
      case 'bottom-right':
        newRect.width = clampedMouseX - startBounds.x
        newRect.height = clampedMouseY - startBounds.y
        break
    }
    
    // 最終的な境界制限を適用
    const clamped = clampNormalized(newRect.x, newRect.y, newRect.width, newRect.height)
    
    return {
      ...newRect,
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height
    }
  }, [clampNormalized, addDebugLog])

  // PointerDown イベントハンドラ
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const canvasRect = canvas.getBoundingClientRect()
    const screenX = event.clientX - canvasRect.left
    const screenY = event.clientY - canvasRect.top
    const normalized = screenToNormalized(screenX, screenY, canvas)
    
    addDebugLog(`🖱️ PointerDown: screen(${screenX.toFixed(1)}, ${screenY.toFixed(1)}) → normalized(${normalized.x.toFixed(3)}, ${normalized.y.toFixed(3)})`)
    
    // リサイズハンドルチェック
    const resizeHandle = getResizeHandle(normalized.x, normalized.y, rectangle, canvas)
    if (resizeHandle) {
      addDebugLog(`🔧 Resize handle detected: ${resizeHandle}`)
      try {
        canvas.setPointerCapture(event.pointerId)
        addDebugLog(`✅ setPointerCapture success: ${event.pointerId}`)
        
        setDragState({
          isDragging: false,
          isResizing: true,
          dragOffset: { x: 0, y: 0 },
          resizeHandle,
          startBounds: { ...rectangle },
          capturedPointerId: event.pointerId
        })
      } catch (error) {
        addDebugLog(`❌ setPointerCapture failed: ${error}`)
      }
      return
    }
    
    // 長方形内でのドラッグ開始
    if (isInsideRectangle(normalized.x, normalized.y, rectangle)) {
      addDebugLog(`✋ Drag start inside rectangle`)
      try {
        canvas.setPointerCapture(event.pointerId)
        addDebugLog(`✅ setPointerCapture success: ${event.pointerId}`)
        
        setDragState({
          isDragging: true,
          isResizing: false,
          dragOffset: { x: normalized.x - rectangle.x, y: normalized.y - rectangle.y },
          resizeHandle: null,
          startBounds: null,
          capturedPointerId: event.pointerId
        })
      } catch (error) {
        addDebugLog(`❌ setPointerCapture failed: ${error}`)
      }
    }
  }, [rectangle, getResizeHandle, isInsideRectangle, addDebugLog, screenToNormalized])

  // PointerMove イベントハンドラ
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const canvasRect = canvas.getBoundingClientRect()
    const screenX = event.clientX - canvasRect.left
    const screenY = event.clientY - canvasRect.top
    const normalized = screenToNormalized(screenX, screenY, canvas)
    
    // キャンバス外かどうかの判定（スクリーン座標ベース）
    const isOutOfBounds = screenX < 0 || screenX > canvas.width || screenY < 0 || screenY > canvas.height
    
    // 正規化座標の境界外判定
    const isNormalizedOutOfBounds = normalized.x < 0 || normalized.x > 1 || normalized.y < 0 || normalized.y > 1
    
    // ドラッグ中の処理
    if (dragState.isDragging && event.pointerId === dragState.capturedPointerId) {
      const newX = normalized.x - dragState.dragOffset.x
      const newY = normalized.y - dragState.dragOffset.y
      
      addDebugLog(`🔄 Dragging: norm(${normalized.x.toFixed(3)}, ${normalized.y.toFixed(3)}) ${isNormalizedOutOfBounds ? '[NORM OUT OF BOUNDS]' : ''} ${isOutOfBounds ? '[SCREEN OUT OF BOUNDS]' : ''}`)
      
      // 正規化座標での境界制限を適用してから更新
      const clamped = clampNormalized(newX, newY, rectangle.width, rectangle.height)
      setRectangle(prev => ({
        ...prev,
        x: clamped.x,
        y: clamped.y
      }))
      return
    }
    
    // リサイズ中の処理
    if (dragState.isResizing && dragState.resizeHandle && dragState.startBounds && event.pointerId === dragState.capturedPointerId) {
      addDebugLog(`🔧 Resizing: norm(${normalized.x.toFixed(3)}, ${normalized.y.toFixed(3)}) ${isNormalizedOutOfBounds ? '[NORM OUT OF BOUNDS]' : ''} ${isOutOfBounds ? '[SCREEN OUT OF BOUNDS]' : ''} handle: ${dragState.resizeHandle}`)
      
      const newRect = handleResize(normalized.x, normalized.y, dragState.resizeHandle, dragState.startBounds)
      setRectangle(newRect)
      return
    }
    
    // ホバー時のカーソル変更
    const handle = getResizeHandle(normalized.x, normalized.y, rectangle, canvas)
    if (handle) {
      canvas.style.cursor = handle.includes('left') && handle.includes('top') || handle.includes('right') && handle.includes('bottom') 
        ? 'nw-resize' 
        : 'ne-resize'
    } else if (isInsideRectangle(normalized.x, normalized.y, rectangle)) {
      canvas.style.cursor = 'move'
    } else {
      canvas.style.cursor = 'default'
    }
  }, [dragState, rectangle, handleResize, getResizeHandle, isInsideRectangle, addDebugLog, screenToNormalized, clampNormalized])

  // PointerUp イベントハンドラ
  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (event.pointerId === dragState.capturedPointerId) {
      addDebugLog(`🛑 PointerUp: releasing capture ${event.pointerId}`)
      
      try {
        canvas.releasePointerCapture(event.pointerId)
        addDebugLog(`✅ releasePointerCapture success`)
      } catch (error) {
        addDebugLog(`⚠️ releasePointerCapture warning: ${error}`)
      }
      
      setDragState({
        isDragging: false,
        isResizing: false,
        dragOffset: { x: 0, y: 0 },
        resizeHandle: null,
        startBounds: null,
        capturedPointerId: null
      })
      
      canvas.style.cursor = 'default'
    }
  }, [dragState.capturedPointerId, addDebugLog])

  // キャンバス描画の更新
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    draw(ctx, rectangle)
  }, [rectangle, draw])

  // 初期描画
  useEffect(() => {
    addDebugLog('🎨 Canvas initialized')
  }, [addDebugLog])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Canvas Resize Test - Normalized Coordinates (0.0-1.0)
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* キャンバス部分 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Interactive Canvas
            </h2>
            <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="border border-gray-400 bg-white cursor-default"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{ touchAction: 'none' }} // タッチスクリーン対応
              />
            </div>
            
            {/* 操作説明 */}
            <div className="mt-4 text-sm text-gray-600">
              <h3 className="font-semibold mb-2">操作方法:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>長方形をクリック&ドラッグして移動</li>
                <li>赤い四角（ハンドル）をドラッグしてリサイズ</li>
                <li><strong>キャンバス外にドラッグして動作確認</strong></li>
                <li><strong>ハンドルを逆方向に移動して座標入れ替えテスト</strong></li>
                <li>正規化座標系（0.0-1.0）で境界制限テスト</li>
                <li>setPointerCapture のみ使用</li>
                <li>グリッド表示: 10%間隔の点線グリッド</li>
              </ul>
            </div>
          </div>
          
          {/* 状態表示・デバッグログ */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              State & Debug Log
            </h2>
            
            {/* 現在の状態 */}
            <div className="bg-gray-100 rounded p-4 mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">Current State (Normalized 0.0-1.0):</h3>
              <div className="text-sm font-mono space-y-1">
                <div>Rectangle: x={rectangle.x.toFixed(3)}, y={rectangle.y.toFixed(3)}, w={rectangle.width.toFixed(3)}, h={rectangle.height.toFixed(3)}</div>
                <div className={`${(rectangle.x + rectangle.width) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                  Right Edge: {(rectangle.x + rectangle.width).toFixed(3)} {(rectangle.x + rectangle.width) > 1.0 ? '⚠️ > 1.0' : '✅ ≤ 1.0'}
                </div>
                <div className={`${(rectangle.y + rectangle.height) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                  Bottom Edge: {(rectangle.y + rectangle.height).toFixed(3)} {(rectangle.y + rectangle.height) > 1.0 ? '⚠️ > 1.0' : '✅ ≤ 1.0'}
                </div>
                <div className={`${rectangle.width < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Width: {rectangle.width.toFixed(3)} {rectangle.width < 0 ? '🔄 Will flip' : '✅ Positive'}
                </div>
                <div className={`${rectangle.height < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Height: {rectangle.height.toFixed(3)} {rectangle.height < 0 ? '🔄 Will flip' : '✅ Positive'}
                </div>
                <div>Dragging: {dragState.isDragging ? '🟢 YES' : '🔴 NO'}</div>
                <div>Resizing: {dragState.isResizing ? '🟢 YES' : '🔴 NO'}</div>
                <div>Captured ID: {dragState.capturedPointerId ?? 'None'}</div>
                <div>Resize Handle: {dragState.resizeHandle ?? 'None'}</div>
                {dragState.dragOffset && (
                  <div>Drag Offset: x={dragState.dragOffset.x.toFixed(3)}, y={dragState.dragOffset.y.toFixed(3)}</div>
                )}
              </div>
            </div>
            
            {/* デバッグログ */}
            <div className="bg-black text-green-400 rounded p-4 h-80 overflow-y-auto">
              <h3 className="font-semibold mb-2">Debug Log:</h3>
              <div className="text-xs font-mono whitespace-pre-wrap">
                {debugInfo.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
              </div>
            </div>
            
            {/* クリアボタン */}
            <button
              type="button"
              onClick={() => setDebugInfo([])}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Clear Debug Log
            </button>
          </div>
        </div>
        
        {/* テスト項目 */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-4">
            🧪 Test Scenarios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded border">
              <h3 className="font-semibold text-gray-700 mb-2">✅ 正規化座標での操作</h3>
              <p className="text-sm text-gray-600">0.0-1.0の正規化座標系での移動・リサイズ</p>
            </div>
            <div className="bg-white p-4 rounded border">
              <h3 className="font-semibold text-gray-700 mb-2">🎯 境界制限テスト</h3>
              <p className="text-sm text-gray-600">1.0を超える座標での自動境界制限</p>
            </div>
            <div className="bg-white p-4 rounded border">
              <h3 className="font-semibold text-gray-700 mb-2">🔄 座標入れ替えテスト</h3>
              <p className="text-sm text-gray-600">負値時の自動座標・サイズ入れ替え</p>
            </div>
            <div className="bg-white p-4 rounded border">
              <h3 className="font-semibold text-gray-700 mb-2">🔧 Canvas外ドラッグ</h3>
              <p className="text-sm text-gray-600">キャンバス外への連続ドラッグ動作確認</p>
            </div>
            <div className="bg-white p-4 rounded border">
              <h3 className="font-semibold text-gray-700 mb-2">⚡ setPointerCapture</h3>
              <p className="text-sm text-gray-600">ポインターキャプチャの継続性テスト</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}