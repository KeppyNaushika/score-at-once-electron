"use client"

import ImageCanvas from "./ImageCanvas"
import LayoutRegionList from "./LayoutRegionList"
import { CropRegionArea, CropRegionAreaType } from "@/types/common.types"
import { useState } from "react"
import { toast } from "sonner"

type LayoutRegionEditorProps = {
  areas: CropRegionArea[]
  setAreas: React.Dispatch<React.SetStateAction<CropRegionArea[]>>
  onCreateRegion?: (type: CropRegionAreaType, coords: { x: number; y: number; width: number; height: number }) => Promise<void>
  onUpdateRegion?: (index: number, coords: { x: number; y: number; width: number; height: number }) => Promise<void>
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  projectPageId: string | null
}

const LayoutRegionEditor = ({
  areas,
  setAreas,
  onCreateRegion,
  onUpdateRegion,
  disabled,
  backgroundImageUrl,
  imageDimensions,
  projectPageId,
}: LayoutRegionEditorProps) => {
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(
    null,
  )

  const handleUpdateArea = async (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
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
        await window.electronAPI.deleteLayoutRegion(areaToDelete.id)
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
    customCoords?: { x: number; y: number; width: number; height: number },
  ) => {
    if (!projectPageId) {
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
        projectPageId: projectPageId,
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
              areas.filter((a) => a.type === "QUESTION_ANSWER").length + 1
            }`,
            type: "QUESTION_ANSWER",
            points: 10, // デフォルトポイント
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
          projectPageId={projectPageId}
        />
      </div>

      {/* Right Side - Region List with independent scroll */}
      <div className="bg-background relative w-80 flex-shrink-0 border-l">
        <LayoutRegionList
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={setSelectedAreaIndex}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

export default LayoutRegionEditor
