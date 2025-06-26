"use client"

import { AreaType } from "@prisma/client"
import { useImageCanvasInteraction } from "./hooks/useImageCanvasInteraction"
import { AreaRenderer } from "./components/AreaRenderer"
import { DragPreview } from "./components/DragPreview"
import { LayoutRegionArea } from "../../../types/common.types"
import { useCallback, useEffect, useRef, useState } from "react"

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: LayoutRegionArea[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onAddAreaByDrag: (
    type: AreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onDeleteArea: (index: number) => void
  disabled: boolean
  masterImageId: string | null
}

const ImageCanvas = ({
  backgroundImageUrl,
  imageDimensions,
  areas,
  selectedAreaIndex,
  onSelectArea,
  onAddAreaByDrag,
  onUpdateArea,
  onDeleteArea,
  disabled,
  masterImageId,
}: ImageCanvasProps) => {
  console.log("ImageCanvas - props:", {
    backgroundImageUrl,
    imageDimensions,
    areas,
    selectedAreaIndex,
    disabled,
    masterImageId
  })
  // zoom/pan機能を実装
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [showScrollHelp, setShowScrollHelp] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  
  // ホイールイベントのデバウンシング用
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWheelTimeRef = useRef<number>(0)

  const {
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    imageContainerRef,
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
  } = useImageCanvasInteraction({
    disabled,
    backgroundImageUrl,
    imageDimensions,
    masterImageId,
    areas,
    onAddAreaByDrag,
    onUpdateArea,
    zoom,
    pan,
  })

  // キーボードイベントハンドラー（削除機能 + スクロール機能）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 削除機能
      if (selectedAreaIndex !== null) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          onDeleteArea(selectedAreaIndex)
          return
        }
      }
      
      // パン機能（ImageCanvasがフォーカスされているとき）
      if (imageContainerRef.current && imageContainerRef.current.contains(document.activeElement)) {
        const panSpeed = 20
        
        // パン制限を計算するヘルパー関数（画像がコンテナより小さい場合は制限しない）
        const applyPanLimits = (newPan: { x: number; y: number }) => {
          if (imageDimensions && imageContainerRef.current) {
            const containerWidth = imageContainerRef.current.clientWidth
            const containerHeight = imageContainerRef.current.clientHeight
            const imageWidth = imageDimensions.width * zoom
            const imageHeight = imageDimensions.height * zoom
            
            let result = { ...newPan }
            
            // 画像がコンテナより大きい場合のみ制限を適用
            if (imageWidth > containerWidth) {
              const maxPanX = (imageWidth - containerWidth) / 2
              result.x = Math.max(-maxPanX, Math.min(maxPanX, newPan.x))
            }
            
            if (imageHeight > containerHeight) {
              const maxPanY = (imageHeight - containerHeight) / 2
              result.y = Math.max(-maxPanY, Math.min(maxPanY, newPan.y))
            }
            
            return result
          }
          return newPan
        }
        
        switch(e.key) {
          case 'ArrowUp':
            e.preventDefault()
            e.stopPropagation()
            setPan(prev => applyPanLimits({ x: prev.x, y: prev.y + panSpeed }))
            break
          case 'ArrowDown':
            e.preventDefault()
            e.stopPropagation()
            setPan(prev => applyPanLimits({ x: prev.x, y: prev.y - panSpeed }))
            break
          case 'ArrowLeft':
            e.preventDefault()
            e.stopPropagation()
            setPan(prev => applyPanLimits({ x: prev.x + panSpeed, y: prev.y }))
            break
          case 'ArrowRight':
            e.preventDefault()
            e.stopPropagation()
            setPan(prev => applyPanLimits({ x: prev.x - panSpeed, y: prev.y }))
            break
          case 'PageUp':
            e.preventDefault()
            e.stopPropagation()
            setPan(prev => applyPanLimits({ x: prev.x, y: prev.y + panSpeed * 5 }))
            break
          case 'PageDown':
            e.preventDefault()
            e.stopPropagation()
            setPan(prev => applyPanLimits({ x: prev.x, y: prev.y - panSpeed * 5 }))
            break
          case 'Home':
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }
            break
          case '+':
          case '=':
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              const newZoom = Math.min(5, zoom + 0.1)
              setZoom(newZoom)
              // ズーム後のパン制限再適用
              setPan(prev => applyPanLimits(prev))
            }
            break
          case '-':
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              const newZoom = Math.max(0.1, zoom - 0.1)
              setZoom(newZoom)
              // ズーム後のパン制限再適用
              setPan(prev => applyPanLimits(prev))
            }
            break
          case '0':
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedAreaIndex, onDeleteArea])

  // refの状態を監視とホイールイベントリスナーの追加（containerが準備された後）
  useEffect(() => {
    console.log("ImageCanvas - imageContainerRef.current:", imageContainerRef.current)
    
    // ホイールイベントハンドラーを別途追加（passive: falseで強制）
    const handleWheel = (e: WheelEvent) => {
      console.log("ImageCanvas - wheel event detected:", e.deltaY, e.ctrlKey, e.shiftKey)
      e.preventDefault()
      e.stopPropagation()
      
      // macOSトラックパッドの加速度を考慮した正規化
      const normalizeWheelDelta = (delta: number) => {
        const absDelta = Math.abs(delta)
        
        // 段階的なスケーリング（非線形）
        let normalizedAbs
        if (absDelta <= 10) {
          // 小さな入力: そのまま
          normalizedAbs = absDelta * 0.8
        } else if (absDelta <= 50) {
          // 中程度の入力: 緩やかに抑制
          normalizedAbs = 8 + (absDelta - 10) * 0.5
        } else {
          // 大きな入力: 強く抑制
          normalizedAbs = 28 + (Math.min(absDelta, 200) - 50) * 0.2
        }
        
        // 最大値でクリップ
        normalizedAbs = Math.min(normalizedAbs, 50)
        
        // 元の符号を保持
        return delta > 0 ? normalizedAbs : -normalizedAbs
      }
      
      // 連続イベントのデバウンシング
      const now = Date.now()
      const timeSinceLastWheel = now - lastWheelTimeRef.current
      lastWheelTimeRef.current = now
      
      // 短時間での連続イベントの場合はさらに抑制
      const debounceMultiplier = timeSinceLastWheel < 50 ? 0.3 : 1
      
      if (e.ctrlKey) {
        // Ctrl + ホイール: ズーム
        const normalizedDelta = normalizeWheelDelta(e.deltaY) * debounceMultiplier
        const zoomSpeed = 0.01 // ズーム速度をさらに緊密に調整
        const newZoom = zoom - normalizedDelta * zoomSpeed
        const clampedZoom = Math.max(0.1, Math.min(5, newZoom))
        console.log("ImageCanvas - zoom change:", zoom, "->", clampedZoom)
        setZoom(clampedZoom)
        
        // ズーム後のパン制限を再計算（画像がコンテナより小さい場合は制限しない）
        if (imageDimensions && imageContainerRef.current) {
          const containerWidth = imageContainerRef.current.clientWidth
          const containerHeight = imageContainerRef.current.clientHeight
          const imageWidth = imageDimensions.width * clampedZoom
          const imageHeight = imageDimensions.height * clampedZoom
          
          setPan(prev => {
            let newPan = { ...prev }
            
            // 画像がコンテナより大きい場合のみ制限を適用
            if (imageWidth > containerWidth) {
              const maxPanX = (imageWidth - containerWidth) / 2
              newPan.x = Math.max(-maxPanX, Math.min(maxPanX, prev.x))
            }
            
            if (imageHeight > containerHeight) {
              const maxPanY = (imageHeight - containerHeight) / 2
              newPan.y = Math.max(-maxPanY, Math.min(maxPanY, prev.y))
            }
            
            return newPan
          })
        }
      } else {
        // 通常のホイール: パン
        const normalizedDelta = normalizeWheelDelta(e.deltaY) * debounceMultiplier
        const panSpeed = 8 // パン速度をさらに緊密に調整
        let newPan = { ...pan }
        
        if (e.shiftKey) {
          // Shift + ホイール: 横パン
          newPan.x = pan.x - normalizedDelta * panSpeed
        } else {
          // 通常のホイール: 縦パン
          newPan.y = pan.y - normalizedDelta * panSpeed
        }
        
        // パン制限を適用（画像がコンテナより小さい場合は制限しない）
        if (imageDimensions && imageContainerRef.current) {
          const containerWidth = imageContainerRef.current.clientWidth
          const containerHeight = imageContainerRef.current.clientHeight
          const imageWidth = imageDimensions.width * zoom
          const imageHeight = imageDimensions.height * zoom
          
          console.log("ImageCanvas - pan limits calculation:", {
            containerWidth, containerHeight, imageWidth, imageHeight, zoom
          })
          
          // 画像がコンテナより大きい場合のみ制限を適用
          if (imageWidth > containerWidth) {
            const maxPanX = (imageWidth - containerWidth) / 2
            newPan.x = Math.max(-maxPanX, Math.min(maxPanX, newPan.x))
          }
          
          if (imageHeight > containerHeight) {
            const maxPanY = (imageHeight - containerHeight) / 2
            newPan.y = Math.max(-maxPanY, Math.min(maxPanY, newPan.y))
          }
        }
        
        console.log("ImageCanvas - pan change:", pan, "->", newPan)
        setPan(newPan)
      }
    }
    
    // DOM要素が利用可能になるのを待つ
    const addWheelListener = () => {
      const container = imageContainerRef.current
      if (container) {
        console.log("ImageCanvas - adding wheel event listener to:", container)
        container.addEventListener('wheel', handleWheel, { passive: false })
        return container
      }
      return null
    }
    
    // 即座に試す
    let container = addWheelListener()
    
    // もしcontainerがまだない場合、少し待つ
    const timeoutId = !container ? setTimeout(() => {
      container = addWheelListener()
    }, 100) : null
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (container) {
        console.log("ImageCanvas - removing wheel event listener from:", container)
        container.removeEventListener('wheel', handleWheel)
      }
    }
  }, [zoom, pan, imageDimensions])
  
  // ウィンドウリサイズ対応（別のuseEffect）
  useEffect(() => {
    const handleResize = () => {
      // 少し遅延を入れてDOM更新を待つ
      setTimeout(() => {
        if (imageContainerRef.current) {
          console.log("ImageCanvas - window resized, triggering re-render")
          // フォースアップデートのためにstateを変更
          setIsPanning(prev => !prev)
          setTimeout(() => setIsPanning(prev => !prev), 10)
        }
      }, 100)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* スクロール操作のヘルプ表示 */}
      {showScrollHelp && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs p-2 rounded z-20 max-w-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold">スクロール操作:</span>
            <button 
              onClick={() => setShowScrollHelp(false)}
              className="text-white hover:text-gray-300 ml-2"
              aria-label="ヘルプを閉じる"
            >
              ×
            </button>
          </div>
          <div>ホイール: 上下パン</div>
          <div>Shift + ホイール: 左右パン</div>
          <div>Ctrl + ホイール: ズーム</div>
          <div>中ボタンドラッグ: パン</div>
          <div>矢印キー: パン</div>
          <div>Page Up/Down: 大幅パン</div>
          <div>Ctrl + Home: リセット</div>
          <div>ズーム: {Math.round(zoom * 100)}%</div>
          <div>パン: X={Math.round(pan.x)}, Y={Math.round(pan.y)}</div>
          <div className="text-green-300">⚡ macOSトラックパッド加速度正規化済み</div>
        </div>
      )}
      
      {/* ヘルプ再表示ボタン */}
      {!showScrollHelp && (
        <button
          onClick={() => setShowScrollHelp(true)}
          className="absolute top-2 right-2 bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded z-20"
          aria-label="スクロールヘルプを表示"
        >
          ?
        </button>
      )}
      
      {/* 独立スクロール可能な画像コンテナ */}
      <div
        ref={imageContainerRef}
        className="relative w-full h-full cursor-crosshair overflow-hidden focus:outline-none"
        tabIndex={0}
        onMouseDown={(e) => {
          if (e.button === 0) {
            // 領域作成のためのhandleMouseDown
            handleMouseDown(e)
          } else if (e.button === 1) {
            // 中ボタン: パン開始
            e.preventDefault()
            setIsPanning(true)
            setLastPanPoint({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseMove={(e) => {
          if (isPanning) {
            const deltaX = e.clientX - lastPanPoint.x
            const deltaY = e.clientY - lastPanPoint.y
            let newPan = {
              x: pan.x + deltaX,
              y: pan.y + deltaY
            }
            
            // パン制限を適用（画像がコンテナより小さい場合は制限しない）
            if (imageDimensions && imageContainerRef.current) {
              const containerWidth = imageContainerRef.current.clientWidth
              const containerHeight = imageContainerRef.current.clientHeight
              const imageWidth = imageDimensions.width * zoom
              const imageHeight = imageDimensions.height * zoom
              
              // 画像がコンテナより大きい場合のみ制限を適用
              if (imageWidth > containerWidth) {
                const maxPanX = (imageWidth - containerWidth) / 2
                newPan.x = Math.max(-maxPanX, Math.min(maxPanX, newPan.x))
              }
              
              if (imageHeight > containerHeight) {
                const maxPanY = (imageHeight - containerHeight) / 2
                newPan.y = Math.max(-maxPanY, Math.min(maxPanY, newPan.y))
              }
            }
            
            setPan(newPan)
            setLastPanPoint({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseUp={(e) => {
          if (e.button === 1) {
            setIsPanning(false)
          }
        }}
        onMouseLeave={() => {
          setIsPanning(false)
        }}
        style={{
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : "none",
          backgroundSize: imageDimensions 
            ? `${imageDimensions.width * zoom}px ${imageDimensions.height * zoom}px`
            : 'auto',
          backgroundRepeat: "no-repeat", 
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          minHeight: imageDimensions 
            ? `${Math.max(400, imageDimensions.height * zoom)}px`
            : "400px",
          minWidth: imageDimensions 
            ? `${Math.max(600, imageDimensions.width * zoom)}px`
            : "600px",
          cursor: isPanning ? 'grabbing' : 'crosshair',
        }}
      >
        <AreaRenderer
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={onSelectArea}
          onResizeMouseDown={handleResizeMouseDown}
          onMoveMouseDown={handleMoveMouseDown}
          imageDimensions={imageDimensions}
          containerRef={imageContainerRef as any}
          zoom={zoom}
          pan={pan}
        />

        <DragPreview
          dragging={dragging}
          dragStartCoords={dragStartCoords}
          dragCurrentCoords={dragCurrentCoords}
          imageDimensions={imageDimensions}
          containerRef={imageContainerRef as any}
          zoom={zoom}
          pan={pan}
        />
      </div>
    </div>
  )
}

export default ImageCanvas