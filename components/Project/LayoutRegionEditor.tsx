"use client"

import { useState } from "react"
import { Prisma, AreaType } from "@prisma/client"
import { toast } from "sonner"
import LayoutRegionList from "./LayoutRegionList"
import ImageCanvas from "./ImageCanvas"
import LayoutRegionForm from "./LayoutRegionForm"

type LayoutRegionEditorProps = {
  areas: (Omit<
    Prisma.LayoutRegionCreateWithoutProjectLayoutInput,
    "masterImage"
  > & { id?: string; masterImageId: string })[]
  setAreas: React.Dispatch<React.SetStateAction<any[]>> // より具体的な型に変更を検討
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

  const handleAreaChange = (index: number, field: string, value: any) => {
    const newAreas = [...areas]
    if (field === "points" && value !== "") {
      newAreas[index] = { ...newAreas[index], [field]: parseFloat(value) }
    } else if (field === "points" && value === "") {
      newAreas[index] = { ...newAreas[index], [field]: null }
    } else {
      newAreas[index] = { ...newAreas[index], [field]: value }
    }
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

  const removeArea = (index: number) => {
    setAreas(areas.filter((_, i) => i !== index))
    setSelectedAreaIndex(null)
  }

  const selectedArea =
    selectedAreaIndex !== null ? areas[selectedAreaIndex] : null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <div className="md:col-span-2">
        <LayoutRegionList
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={setSelectedAreaIndex}
          disabled={disabled}
        />
      </div>
      <div className="md:col-span-3">
        <ImageCanvas
          backgroundImageUrl={backgroundImageUrl}
          imageDimensions={imageDimensions}
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={setSelectedAreaIndex}
          onAddAreaByDrag={addArea} // Dragで追加する際も同じaddArea関数を使用
          disabled={disabled}
          masterImageId={masterImageId}
        />
      </div>
      <div className="mt-4 md:col-span-5">
        <LayoutRegionForm
          selectedArea={selectedArea}
          selectedAreaIndex={selectedAreaIndex}
          onAreaChange={handleAreaChange}
          onRemoveArea={removeArea}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

export default LayoutRegionEditor
