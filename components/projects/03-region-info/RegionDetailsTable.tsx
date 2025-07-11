"use client"

import { DeleteConfirmModal } from "@/components/projects/03-region-info/components/DeleteConfirmModal"
import { RegionTableRow } from "@/components/projects/03-region-info/components/RegionTableRow"
import { useDragAndDrop } from "@/components/projects/03-region-info/hooks/useDragAndDrop"
import { useKeyboardNavigation } from "@/components/projects/03-region-info/hooks/useKeyboardNavigation"
import type { LayoutRegionWithDetails } from "@/types/electron"
import { useState } from "react"

type RegionDetailsTableProps = {
  regions: LayoutRegionWithDetails[]
  setRegions: React.Dispatch<React.SetStateAction<LayoutRegionWithDetails[]>>
  disabled: boolean
  selectedRowIndex: number | null
  setSelectedRowIndex: React.Dispatch<React.SetStateAction<number | null>>
  selectedMasterImageId?: string
}

const RegionDetailsTable = ({
  regions,
  setRegions,
  disabled,
  selectedRowIndex,
  setSelectedRowIndex,
  selectedMasterImageId,
}: RegionDetailsTableProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [regionToDelete, setRegionToDelete] = useState<number | null>(null)

  // 全ページの領域を表示（統一順序）
  const filteredRegions = regions

  // カスタムフック
  const { handleKeyDown } = useKeyboardNavigation({ filteredRegions })
  const {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop({
    regions,
    setRegions,
    selectedRowIndex,
    setSelectedRowIndex,
  })

  const handleRegionChange = (
    globalIndex: number,
    field: string,
    value: any,
  ) => {
    const newRegions = [...regions]
    if (field === "points" && value !== "") {
      newRegions[globalIndex] = {
        ...newRegions[globalIndex],
        [field]: parseFloat(value),
      }
    } else if (field === "points" && value === "") {
      newRegions[globalIndex] = { ...newRegions[globalIndex], [field]: null }
    } else {
      newRegions[globalIndex] = { ...newRegions[globalIndex], [field]: value }
    }
    setRegions(newRegions)
  }

  const handleDeleteRegion = (index: number) => {
    setRegionToDelete(index)
    setDeleteModalOpen(true)
  }

  const confirmDeleteRegion = async () => {
    if (regionToDelete !== null) {
      const regionToDeleteData = regions[regionToDelete]

      try {
        // データベースから削除（IDがある場合のみ）
        if (regionToDeleteData?.id) {
          await window.electronAPI.deleteLayoutRegion(regionToDeleteData.id)
        }

        // UI状態を更新
        const newRegions = regions.filter((_, i) => i !== regionToDelete)
        setRegions(newRegions)
        setDeleteModalOpen(false)
        setRegionToDelete(null)

        // 選択行インデックスを調整
        if (selectedRowIndex === regionToDelete) {
          setSelectedRowIndex(null)
        } else if (
          selectedRowIndex !== null &&
          selectedRowIndex > regionToDelete
        ) {
          setSelectedRowIndex(selectedRowIndex - 1)
        }
      } catch (error) {
        console.error("Error deleting layout region:", error)
        // エラーが発生した場合はモーダルは閉じるが、データは削除しない
        setDeleteModalOpen(false)
        setRegionToDelete(null)
      }
    }
  }

  if (filteredRegions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-4xl">🎨</div>
        <h3 className="mb-2 text-lg font-medium">
          {selectedMasterImageId
            ? "このページに領域がありません"
            : "領域を作成してください"}
        </h3>
        <p className="text-muted-foreground">
          {selectedMasterImageId
            ? "前のステップに戻って、このページに領域を作成してください。"
            : "前のステップに戻って、模範解答上で領域を作成してください。"}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">
          作成した領域の詳細設定（全ページ統一順序）
        </h3>
        <p className="text-muted-foreground text-sm">
          各行をクリックして選択し、種類・ラベル・配点などを設定してください。ドラッグ&ドロップで順序を変更できます。
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
              <th className="border-border w-16 border px-2 py-1 text-left font-medium">
                ページ
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
            {filteredRegions.map((region, globalIndex) => {
              const isSelected = selectedRowIndex === globalIndex
              const isDragged = dragState.draggedIndex === globalIndex
              const isDraggedOver = dragState.dragOverIndex === globalIndex

              return (
                <RegionTableRow
                  key={region.id || `region-${globalIndex}`}
                  region={region}
                  globalIndex={globalIndex}
                  isSelected={isSelected}
                  isDragged={isDragged}
                  isDraggedOver={isDraggedOver}
                  disabled={disabled}
                  onRegionChange={handleRegionChange}
                  onKeyDown={handleKeyDown}
                  onDelete={handleDeleteRegion}
                  onSelect={setSelectedRowIndex}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteRegion}
      />
    </div>
  )
}

export default RegionDetailsTable
