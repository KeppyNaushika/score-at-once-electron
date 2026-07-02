"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { CropRegionArea, CropRegionAreaType } from "@/types/common.types"

import { useFrameDetection } from "../hooks/useFrameDetection"
import { DetectedRect } from "../types"
import CropRegionList from "./CropRegionList"
import { DetectionModeToggle } from "./DetectionModeToggle"
import { DetectionSettingsPanel } from "./DetectionSettingsPanel"
import ImageCanvas from "./ImageCanvas"

type CropRegionEditorProps = {
  areas: CropRegionArea[]
  setAreas: React.Dispatch<React.SetStateAction<CropRegionArea[]>>
  onCreateRegion?: (
    type: CropRegionAreaType,
    coords: { x: number; y: number; width: number; height: number }
  ) => Promise<void>
  onUpdateRegion?: (
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
  areas,
  setAreas,
  onCreateRegion,
  onUpdateRegion,
  disabled,
  backgroundImageUrl,
  imageDimensions,
  examPageId,
  defaultPoints,
  onDefaultPointsChange,
}: CropRegionEditorProps) => {
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
      if (onCreateRegion) {
        await onCreateRegion("QUESTION_ANSWER", {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        })
      }
    },
    [examPageId, onCreateRegion]
  )

  const handleUpdateArea = async (
    index: number,
    coords: { x: number; y: number; width: number; height: number }
  ) => {
    if (onUpdateRegion) {
      // Use efficient individual update
      await onUpdateRegion(index, coords)
    } else {
      // Fall back to bulk update
      const newAreas = [...areas]
      newAreas[index] = { ...newAreas[index], ...coords }
      setAreas(newAreas)
    }
  }

  const handleDeleteArea = async (index: number) => {
    const areaToDelete = areas[index]

    // DBから削除（IDがある場合のみ）
    if (areaToDelete.id) {
      try {
        await window.electronAPI.deleteCropRegion(areaToDelete.id)
      } catch (error) {
        console.error("Failed to delete area from database:", error)
        toast.error("採点領域の削除に失敗しました")
        return // エラーの場合は削除を中断
      }
    }

    // ローカルステートから削除
    const newAreas = areas.filter((_, i) => i !== index)
    setAreas(newAreas)
    setSelectedAreaIndex(null)
  }

  const addArea = async (
    type: CropRegionAreaType,
    customCoords?: { x: number; y: number; width: number; height: number }
  ) => {
    if (!examPageId) {
      toast.error("基準画像が選択されていません。エリアを追加できません。")
      return
    }

    const coords = {
      x: customCoords?.x ?? 0.05,
      y: customCoords?.y ?? 0.05,
      width: customCoords?.width ?? 0.1,
      height: customCoords?.height ?? 0.05,
    }

    if (onCreateRegion) {
      // Use efficient individual creation
      await onCreateRegion(type, coords)
      setSelectedAreaIndex(areas.length) // Select the newly added area
    } else {
      // Fall back to bulk update
      const newAreaBase = {
        ...coords,
        points: null,
        label: "",
        examPageId: examPageId,
      }

      let newAreaSpecifics = {}
      switch (type) {
        case "STUDENT_NAME":
          newAreaSpecifics = {
            label: "氏名",
            type: "STUDENT_NAME",
          }
          break
        case "STUDENT_ID":
          newAreaSpecifics = {
            label: "生徒番号",
            type: "STUDENT_ID",
          }
          break
        case "QUESTION_ANSWER":
          newAreaSpecifics = {
            label: `設問 ${
              areas.filter((area) => area.type === "QUESTION_ANSWER").length + 1
            }`,
            type: "QUESTION_ANSWER",
            points: defaultPoints,
          }
          break
        case "TOTAL_SCORE":
          newAreaSpecifics = {
            label: "合計点",
            type: "TOTAL_SCORE",
          }
          break
        case "SUBTOTAL_SCORE":
          newAreaSpecifics = {
            label: "小計",
            type: "SUBTOTAL_SCORE",
          }
          break
        default:
          newAreaSpecifics = { label: "新規エリア", type: "OTHER" }
      }

      const newArea = { ...newAreaBase, ...newAreaSpecifics } as CropRegionArea

      const newAreasArray = [...areas, newArea]

      setAreas(newAreasArray)
      setSelectedAreaIndex(areas.length) // 新しく追加されたエリアを選択
    }
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
          onUpdateArea={handleUpdateArea}
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
      <div className="bg-background relative flex h-full w-80 shrink-0 flex-col overflow-hidden border-l">
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
