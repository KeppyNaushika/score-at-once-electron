"use client"

// AreaType enum は削除されたため、文字列型として定義
type AreaType = "QUESTION_ANSWER" | "STUDENT_NAME" | "STUDENT_ID" | "TOTAL_SCORE" | "SUBTOTAL_SCORE" | "MARK" | "COMMENT" | "OTHER"
import { useState } from "react"
import { toast } from "sonner"
import ImageCanvas from "./ImageCanvas"
import LayoutRegionList from "./LayoutRegionList"
import { LayoutRegionArea } from "../../../types/common.types"

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
  console.log("LayoutRegionEditor - props:", {
    areas,
    disabled,
    backgroundImageUrl,
    imageDimensions,
    masterImageId
  })
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
    type: AreaType,
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
      questionNumber: null,
      label: "",
      masterImageId: masterImageId,
    }

    let newAreaSpecifics = {}
    switch (type) {
      case AreaType.STUDENT_NAME:
        newAreaSpecifics = {
          label: "氏名",
          type: AreaType.STUDENT_NAME,
        }
        break
      case AreaType.STUDENT_ID:
        newAreaSpecifics = {
          label: "生徒番号",
          type: AreaType.STUDENT_ID,
        }
        break
      case AreaType.QUESTION_ANSWER:
        newAreaSpecifics = {
          label: `設問 ${
            areas.filter((a) => a.type === AreaType.QUESTION_ANSWER).length + 1
          }`,
          type: AreaType.QUESTION_ANSWER,
          questionNumber: (
            areas.filter((a) => a.type === AreaType.QUESTION_ANSWER).length + 1
          ).toString(),
          points: 10, // デフォルトポイント
        }
        break
      case AreaType.TOTAL_SCORE:
        newAreaSpecifics = {
          label: "合計点",
          type: AreaType.TOTAL_SCORE,
        }
        break
      case AreaType.SUBTOTAL_SCORE:
        newAreaSpecifics = {
          label: "小計",
          type: AreaType.SUBTOTAL_SCORE,
        }
        break
      default:
        newAreaSpecifics = { label: "新規エリア", type: AreaType.OTHER }
    }

    setAreas([...areas, { ...newAreaBase, ...newAreaSpecifics } as LayoutRegionArea])
    setSelectedAreaIndex(areas.length) // 新しく追加されたエリアを選択
  }

  return (
    <div className="flex h-full">
      {/* Left Side - Image Canvas with independent scroll */}
      <div className="flex-1 min-w-0 relative">
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
      <div className="w-80 border-l bg-background flex-shrink-0 relative">
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
