"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AreaType } from "@prisma/client"
import { AlertTriangle, GripVertical, Trash2 } from "lucide-react"
import { useState } from "react"

// AreaTypeの日本語表示マッピング
const areaTypeToJapanese: Record<AreaType, string> = {
  STUDENT_NAME: "氏名",
  STUDENT_ID: "生徒番号",
  QUESTION_ANSWER: "設問解答",
  TOTAL_SCORE: "合計点",
  SUBTOTAL_SCORE: "小計",
  MARK: "マーク",
  COMMENT: "コメント",
  OTHER: "その他",
}

const typeIcons = {
  [AreaType.QUESTION_ANSWER]: "📋",
  [AreaType.STUDENT_NAME]: "📄",
  [AreaType.STUDENT_ID]: "🔢",
  [AreaType.TOTAL_SCORE]: "🏆",
  [AreaType.SUBTOTAL_SCORE]: "🔢",
  [AreaType.MARK]: "✏️",
  [AreaType.COMMENT]: "💬",
  [AreaType.OTHER]: "📎",
}

type RegionDetailsTableProps = {
  regions: any[]
  setRegions: React.Dispatch<React.SetStateAction<any[]>>
  disabled: boolean
  selectedRowIndex: number | null
  setSelectedRowIndex: React.Dispatch<React.SetStateAction<number | null>>
}

type DragState = {
  draggedIndex: number | null
  dragOverIndex: number | null
}

const RegionDetailsTable = ({
  regions,
  setRegions,
  disabled,
  selectedRowIndex,
  setSelectedRowIndex,
}: RegionDetailsTableProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [regionToDelete, setRegionToDelete] = useState<number | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    dragOverIndex: null,
  })

  const handleRegionChange = (index: number, field: string, value: any) => {
    const newRegions = [...regions]
    if (field === "points" && value !== "") {
      newRegions[index] = { ...newRegions[index], [field]: parseFloat(value) }
    } else if (field === "points" && value === "") {
      newRegions[index] = { ...newRegions[index], [field]: null }
    } else {
      newRegions[index] = { ...newRegions[index], [field]: value }
    }
    setRegions(newRegions)
  }

  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIndex: number,
    fieldName: string,
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Move to next row, same field
      const nextRowIndex = rowIndex + 1
      if (nextRowIndex < regions.length) {
        const nextInput = document.querySelector(
          `[data-row="${nextRowIndex}"][data-field="${fieldName}"]`,
        ) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
          nextInput.select()
        }
      }
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault()
      // Move to previous row, same field
      const prevRowIndex = rowIndex - 1
      if (prevRowIndex >= 0) {
        const prevInput = document.querySelector(
          `[data-row="${prevRowIndex}"][data-field="${fieldName}"]`,
        ) as HTMLInputElement
        if (prevInput) {
          prevInput.focus()
          prevInput.select()
        }
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault()
      // Move to next field in same row
      const fieldOrder = ["label", "points"]
      const currentFieldIndex = fieldOrder.indexOf(fieldName)
      if (currentFieldIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentFieldIndex + 1]
        const nextInput = document.querySelector(
          `[data-row="${rowIndex}"][data-field="${nextField}"]`,
        ) as HTMLInputElement
        if (nextInput && !nextInput.disabled) {
          nextInput.focus()
          nextInput.select()
        }
      } else {
        // Move to first field of next row
        const nextRowIndex = rowIndex + 1
        if (nextRowIndex < regions.length) {
          const nextInput = document.querySelector(
            `[data-row="${nextRowIndex}"][data-field="label"]`,
          ) as HTMLInputElement
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault()
      // Move to previous field in same row
      const fieldOrder = ["label", "points"]
      const currentFieldIndex = fieldOrder.indexOf(fieldName)
      if (currentFieldIndex > 0) {
        const prevField = fieldOrder[currentFieldIndex - 1]
        const prevInput = document.querySelector(
          `[data-row="${rowIndex}"][data-field="${prevField}"]`,
        ) as HTMLInputElement
        if (prevInput) {
          prevInput.focus()
          prevInput.select()
        }
      } else {
        // Move to last field of previous row
        const prevRowIndex = rowIndex - 1
        if (prevRowIndex >= 0) {
          const prevInput = document.querySelector(
            `[data-row="${prevRowIndex}"][data-field="points"]`,
          ) as HTMLInputElement
          if (prevInput && !prevInput.disabled) {
            prevInput.focus()
            prevInput.select()
          } else {
            // Fall back to label
            const labelInput = document.querySelector(
              `[data-row="${prevRowIndex}"][data-field="label"]`,
            ) as HTMLInputElement
            if (labelInput) {
              labelInput.focus()
              labelInput.select()
            }
          }
        }
      }
    }
  }

  const handleDeleteRegion = (index: number) => {
    setRegionToDelete(index)
    setDeleteModalOpen(true)
  }

  const confirmDeleteRegion = () => {
    if (regionToDelete !== null) {
      const newRegions = regions.filter((_, i) => i !== regionToDelete)
      setRegions(newRegions)
      setDeleteModalOpen(false)
      setRegionToDelete(null)
      if (selectedRowIndex === regionToDelete) {
        setSelectedRowIndex(null)
      } else if (
        selectedRowIndex !== null &&
        selectedRowIndex > regionToDelete
      ) {
        setSelectedRowIndex(selectedRowIndex - 1)
      }
    }
  }

  const handleDragStart = (index: number) => {
    setDragState({ draggedIndex: index, dragOverIndex: null })
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragState.draggedIndex !== null && dragState.draggedIndex !== index) {
      setDragState((prev) => ({ ...prev, dragOverIndex: index }))
    }
  }

  const handleDragLeave = () => {
    setDragState((prev) => ({ ...prev, dragOverIndex: null }))
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const { draggedIndex } = dragState

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const newRegions = [...regions]
      const draggedItem = newRegions[draggedIndex]

      // Remove the dragged item
      newRegions.splice(draggedIndex, 1)

      // Insert the dragged item at the new position
      newRegions.splice(dropIndex, 0, draggedItem)

      setRegions(newRegions)

      // Update selected row index if needed
      if (selectedRowIndex === draggedIndex) {
        setSelectedRowIndex(dropIndex)
      } else if (selectedRowIndex !== null) {
        if (draggedIndex < selectedRowIndex && dropIndex >= selectedRowIndex) {
          setSelectedRowIndex(selectedRowIndex - 1)
        } else if (
          draggedIndex > selectedRowIndex &&
          dropIndex <= selectedRowIndex
        ) {
          setSelectedRowIndex(selectedRowIndex + 1)
        }
      }
    }

    setDragState({ draggedIndex: null, dragOverIndex: null })
  }

  const handleDragEnd = () => {
    setDragState({ draggedIndex: null, dragOverIndex: null })
  }

  if (regions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-4xl">🎨</div>
        <h3 className="mb-2 text-lg font-medium">領域を作成してください</h3>
        <p className="text-muted-foreground">
          前のステップに戻って、模範解答上で領域を作成してください。
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">作成した領域の詳細設定</h3>
        <p className="text-muted-foreground text-sm">
          各行をクリックして選択し、種類・ラベル・配点などを設定してください。
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="border-border w-full border-collapse border">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-border w-8 border px-2 py-1 text-left font-medium"></th>
              <th className="border-border w-16 border px-2 py-1 text-left font-medium">
                #
              </th>
              <th className="border-border w-36 border px-2 py-1 text-left font-medium">
                種類
              </th>
              <th className="border-border w-40 border px-2 py-1 text-left font-medium">
                ラベル
              </th>
              <th className="border-border w-24 border px-2 py-1 text-left font-medium">
                配点
              </th>
              <th className="border-border w-20 border px-2 py-1 text-center font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region, index) => {
              const isSelected = selectedRowIndex === index
              const icon =
                typeIcons[region.type as AreaType] || typeIcons[AreaType.OTHER]
              const isDragged = dragState.draggedIndex === index
              const isDraggedOver = dragState.dragOverIndex === index

              return (
                <tr
                  key={region.id || `region-${index}`}
                  draggable={!disabled}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`hover:bg-accent/50 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/10 border-primary" : ""
                  } ${isDragged ? "opacity-50" : ""} ${
                    isDraggedOver ? "border-t-4 border-t-blue-500" : ""
                  }`}
                  onClick={() => setSelectedRowIndex(isSelected ? null : index)}
                >
                  <td className="border-border border px-2 py-1">
                    <div className="flex items-center justify-center">
                      <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />
                    </div>
                  </td>
                  <td className="border-border border px-2 py-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                  </td>
                  <td className="border-border border px-2 py-1">
                    <Select
                      value={region.type}
                      onValueChange={(value) =>
                        handleRegionChange(index, "type", value)
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(AreaType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {areaTypeToJapanese[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border-border border px-2 py-1">
                    <Input
                      data-row={index}
                      data-field="label"
                      value={region.label || ""}
                      onChange={(e) =>
                        handleRegionChange(index, "label", e.target.value)
                      }
                      onKeyDown={(e) => handleKeyDown(e, index, "label")}
                      disabled={disabled}
                      placeholder="領域名を入力"
                      className="h-8 w-full min-w-20"
                    />
                  </td>
                  <td className="border-border border px-2 py-1">
                    {region.type === AreaType.QUESTION_ANSWER ? (
                      <Input
                        data-row={index}
                        data-field="points"
                        type="number"
                        value={region.points ?? ""}
                        onChange={(e) =>
                          handleRegionChange(index, "points", e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, index, "points")}
                        disabled={disabled}
                        placeholder="10"
                        className="h-8 w-full min-w-20"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </td>
                  <td className="border-border border px-2 py-1 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteRegion(index)
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>領域の削除確認</span>
            </ModalTitle>
            <ModalDescription className="space-y-2">
              <p>この領域を削除しますか？</p>
              <div className="rounded border border-orange-200 bg-orange-50 px-2 py-1">
                <p className="text-sm font-medium text-orange-700">⚠️ 注意</p>
                <p className="mt-1 text-sm text-orange-600">
                  この領域に関連付けられた採点データがある場合、それらも一緒に削除されます。
                  この操作は元に戻すことができません。
                </p>
              </div>
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDeleteRegion}>
              削除する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default RegionDetailsTable
