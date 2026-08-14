"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import type { CropRegionArea } from "@/components/exams/02-template/types"
import { deleteCropRegionMutation } from "@/queries/cropRegion"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

import { useFrameDetection } from "../hooks/useFrameDetection"
import type { DetectedRect } from "../types"
import CropRegionList from "./CropRegionList"
import { DetectionModeToggle } from "./DetectionModeToggle"
import { DetectionSettingsPanel } from "./DetectionSettingsPanel"
import ImageCanvas from "./ImageCanvas"

type CropRegionEditorProps = {
  examId: string
  areas: CropRegionArea[]
  onCreateRegion: (
    type: CropRegionAreaType,
    coords: { x: number; y: number; width: number; height: number }
  ) => Promise<void>
  onUpdateRegion: (
    index: number,
    coords: { x: number; y: number; width: number; height: number }
  ) => Promise<void>
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  examPageId: string | null
  defaultPoints: number
  onDefaultPointsChange: (points: number) => void
}

const CropRegionEditor = ({
  examId,
  areas,
  onCreateRegion,
  onUpdateRegion,
  disabled,
  backgroundImageUrl,
  imageDimensions,
  examPageId,
  defaultPoints,
  onDefaultPointsChange,
}: CropRegionEditorProps) => {
  const deleteCropRegion = useMutation(deleteCropRegionMutation(examId))
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(
    null
  )
  const [settingsCollapsed, setSettingsCollapsed] = useState(true)

  // 検出機能フック
  const {
    detectedRects,
    isDetecting,
    detectionMode,
    settings,
    setDetectionMode,
    updateSettings,
    resetSettings,
    detectAll,
    findSnappedRects,
    clearDetectedRects,
  } = useFrameDetection({ imageUrl: backgroundImageUrl })

  // 画像が変更されたら検出結果をクリア
  useEffect(() => {
    clearDetectedRects()
  }, [backgroundImageUrl, clearDetectedRects])

  // 検出モードが変更されたら一括検出を実行
  useEffect(() => {
    if (detectionMode !== "manual" && backgroundImageUrl) {
      detectAll()
    }
  }, [detectionMode, backgroundImageUrl, detectAll])

  // 検出枠クリック時のハンドラ
  const handleDetectedRectClick = useCallback(
    async (rect: DetectedRect) => {
      if (!examPageId) return

      // クリックした検出枠を採点領域として作成
      await onCreateRegion("QUESTION_ANSWER", {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    },
    [examPageId, onCreateRegion]
  )

  const handleDeleteArea = async (index: number) => {
    const areaToDelete = areas[index]
    if (!areaToDelete.id) return

    try {
      await deleteCropRegion.mutateAsync(areaToDelete.id)
      setSelectedAreaIndex(null)
    } catch {
      // 失敗の知らせは中央のトーストが出す。ここでは選択を保つだけ
    }
  }

  const addArea = async (
    type: CropRegionAreaType,
    customCoords?: { x: number; y: number; width: number; height: number }
  ) => {
    if (!examPageId) {
      toast.error("基準画像が選択されていません。エリアを追加できません。")
      return
    }

    await onCreateRegion(type, {
      x: customCoords?.x ?? 0.05,
      y: customCoords?.y ?? 0.05,
      width: customCoords?.width ?? 0.1,
      height: customCoords?.height ?? 0.05,
    })
    setSelectedAreaIndex(areas.length) // 新しく追加されたエリアを選択
  }

  return (
    <div className="flex h-full">
      {/* Left Side - Image Canvas with independent scroll */}
      <div className="relative min-w-0 flex-1">
        <ImageCanvas
          backgroundImageUrl={backgroundImageUrl}
          imageDimensions={imageDimensions}
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={setSelectedAreaIndex}
          onAddAreaByDrag={addArea}
          onUpdateArea={onUpdateRegion}
          onDeleteArea={handleDeleteArea}
          disabled={disabled}
          examPageId={examPageId}
          detectedRects={detectedRects}
          detectionMode={detectionMode}
          onDetectedRectClick={handleDetectedRectClick}
          onSnapToDetectedRects={findSnappedRects}
        />
      </div>

      {/* Right Side - Region List with independent scroll */}
      <div className="relative flex h-full w-80 shrink-0 flex-col overflow-hidden border-l bg-background">
        {/* 検出モード切替と設定 */}
        <div className="shrink-0 space-y-3 border-b p-3">
          <DetectionModeToggle
            mode={detectionMode}
            onModeChange={setDetectionMode}
            isDetecting={isDetecting}
            onDetectAll={detectAll}
            disabled={disabled}
          />
          {detectionMode !== "manual" && (
            <DetectionSettingsPanel
              settings={settings}
              onSettingsChange={updateSettings}
              onReset={resetSettings}
              collapsed={settingsCollapsed}
              onToggleCollapse={() => setSettingsCollapsed(!settingsCollapsed)}
            />
          )}
          {detectedRects.length > 0 && (
            <div className="text-xs text-gray-500">
              検出枠: {detectedRects.length}個
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs whitespace-nowrap text-gray-600">
              配点の初期値
            </label>
            <input
              type="number"
              min={0}
              value={defaultPoints}
              onChange={(e) => {
                const points = parseInt(e.target.value)
                if (!isNaN(points) && points >= 0) onDefaultPointsChange(points)
              }}
              className="h-7 w-16 rounded border px-2 text-right text-sm"
            />
            <span className="text-xs text-gray-500">点</span>
          </div>
        </div>

        <CropRegionList
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={setSelectedAreaIndex}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

export default CropRegionEditor
