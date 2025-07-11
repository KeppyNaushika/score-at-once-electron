"use client"

import ImageCanvas from "@/components/projects/02-template/ImageCanvas"
import LayoutRegionList from "@/components/projects/02-template/LayoutRegionList"
import { LayoutRegionArea, LayoutRegionAreaType } from "@/types/common.types"
import { useState } from "react"
import { toast } from "sonner"

type LayoutRegionEditorProps = {
  areas: LayoutRegionArea[]
  setAreas: React.Dispatch<React.SetStateAction<LayoutRegionArea[]>>
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  masterImageId: string | null
}

const LayoutRegionEditor = ({
  areas,
  setAreas,
  disabled,
  backgroundImageUrl,
  imageDimensions,
  masterImageId,
}: LayoutRegionEditorProps) => {
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(
    null,
  )

  const handleUpdateArea = (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => {
    const newAreas = [...areas]
    newAreas[index] = { ...newAreas[index], ...coords }
    setAreas(newAreas)
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

  const addArea = (
    type: LayoutRegionAreaType,
    customCoords?: { x: number; y: number; width: number; height: number },
  ) => {
    if (!masterImageId) {
      toast.error("基準画像が選択されていません。エリアを追加できません。")
      return
    }

    const newAreaBase = {
      x: customCoords?.x ?? 0.05,
      y: customCoords?.y ?? 0.05,
      width: customCoords?.width ?? 0.1,
      height: customCoords?.height ?? 0.05,
      points: null,
      label: "",
      masterImageId: masterImageId,
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

    setAreas([
      ...areas,
      { ...newAreaBase, ...newAreaSpecifics } as LayoutRegionArea,
    ])
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
          onUpdateArea={handleUpdateArea}
          onDeleteArea={handleDeleteArea}
          disabled={disabled}
          masterImageId={masterImageId}
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
