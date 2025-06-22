"use client"

import { AreaType } from "@prisma/client"
import { useState } from "react"
import { toast } from "sonner"
import ImageCanvas from "./ImageCanvas"
import LayoutRegionList from "./LayoutRegionList"

type LayoutRegionEditorProps = {
  areas: any[]
  setAreas: React.Dispatch<React.SetStateAction<any[]>>
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
      sourceAreaIdsJson: null,
      sourceQuestionNumbersJson: null,
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

    setAreas([...areas, { ...newAreaBase, ...newAreaSpecifics }])
    setSelectedAreaIndex(areas.length) // 新しく追加されたエリアを選択
  }

  return (
    <div className="flex h-full flex-col">
      {/* Main Image Canvas */}
      <div className="relative flex-1">
        <ImageCanvas
          backgroundImageUrl={backgroundImageUrl}
          imageDimensions={imageDimensions}
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={setSelectedAreaIndex}
          onAddAreaByDrag={addArea}
          onUpdateArea={handleUpdateArea}
          disabled={disabled}
          masterImageId={masterImageId}
        />
      </div>

      {/* Bottom Panel - Region List */}
      {areas.length > 0 && (
        <div className="bg-background border-t">
          <LayoutRegionList
            areas={areas}
            selectedAreaIndex={selectedAreaIndex}
            onSelectArea={setSelectedAreaIndex}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

export default LayoutRegionEditor
