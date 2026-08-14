"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Palette } from "lucide-react"
import { useCallback, useState } from "react"

import { DeleteConfirmModal } from "@/components/exams/03-region-info/components/DeleteConfirmModal"
import { RegionTableRow } from "@/components/exams/03-region-info/components/RegionTableRow"
import { useDragAndDrop } from "@/components/exams/03-region-info/hooks/useDragAndDrop"
import { useKeyboardNavigation } from "@/components/exams/03-region-info/hooks/useKeyboardNavigation"
import type { CropRegionRow } from "@/queries/cropRegion"
import {
  cropRegionsQuery,
  deleteCropRegionMutation,
  updateCropRegionMutation,
  updateCropRegionOrdersMutation,
} from "@/queries/cropRegion"
import type { CropRegionOmrConfigWithOptions } from "@/types/omr.types"

type RegionDetailsTableProps = {
  examId: string
  regions: CropRegionRow[]
  disabled?: boolean
  selectedRowIndex: number | null
  setSelectedRowIndex: React.Dispatch<React.SetStateAction<number | null>>
  selectedMasterImageId?: string
  getOmrConfig: (cropRegionId: string) => CropRegionOmrConfigWithOptions | null
  onOmrSave: (data: {
    cropRegionId: string
    type: "choice"
    numChoices?: number | null
    choiceLayout?: string | null
    choiceOptions?: Array<{
      choiceIndex: number
      label: string
      isCorrect: boolean
    }>
  }) => Promise<boolean>
  onOmrDelete: (cropRegionId: string) => Promise<boolean>
}

const RegionDetailsTable = ({
  examId,
  regions,
  disabled = false,
  selectedRowIndex,
  setSelectedRowIndex,
  selectedMasterImageId,
  getOmrConfig,
  onOmrSave,
  onOmrDelete,
}: RegionDetailsTableProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [regionToDelete, setRegionToDelete] = useState<number | null>(null)

  const queryClient = useQueryClient()
  const updateCropRegion = useMutation(updateCropRegionMutation(examId))
  const deleteCropRegion = useMutation(deleteCropRegionMutation(examId))
  const updateCropRegionOrders = useMutation(
    updateCropRegionOrdersMutation(examId)
  )

  /**
   * 編集した結果を先にキャッシュへ置く。
   *
   * 打鍵のたびに書くので、取り直しを待つと入力欄が1文字ぶん戻って見える。
   */
  const patchCachedRegions = useCallback(
    (patched: CropRegionRow[]) => {
      queryClient.setQueryData(cropRegionsQuery(examId).queryKey, patched)
    },
    [examId, queryClient]
  )

  /** 並べ替え。順番は行の並びそのものなので、全行の orderIndex を振り直す */
  const handleReorder = useCallback(
    (reordered: CropRegionRow[]) => {
      patchCachedRegions(reordered)
      updateCropRegionOrders.mutate(
        reordered.map((region, index) => ({
          id: region.id,
          orderIndex: index,
        }))
      )
    },
    [patchCachedRegions, updateCropRegionOrders]
  )

  // 全ページの領域を表示（統一順序）
  const filteredRegions = regions

  // カスタムフック
  const { handleKeyDown, handleCompositionStart, handleCompositionEnd } =
    useKeyboardNavigation({ filteredRegions })
  const {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop({
    regions,
    onReorder: handleReorder,
    selectedRowIndex,
    setSelectedRowIndex,
  })

  const handleRegionChange = (
    globalIndex: number,
    field: string,
    value: string | number | null
  ) => {
    const region = regions[globalIndex]
    if (!region) return

    // 配点だけ数値。空欄は「未設定」なので null へ倒す
    const nextValue =
      field === "points"
        ? value === "" || value === null
          ? null
          : parseFloat(String(value))
        : value

    patchCachedRegions(
      regions.map((current) =>
        current.id === region.id ? { ...current, [field]: nextValue } : current
      )
    )
    updateCropRegion.mutate({ id: region.id, data: { [field]: nextValue } })
  }

  const handleDeleteRegion = (index: number) => {
    setRegionToDelete(index)
    setDeleteModalOpen(true)
  }

  const confirmDeleteRegion = async () => {
    if (regionToDelete !== null) {
      const regionToDeleteData = regions[regionToDelete]

      try {
        await deleteCropRegion.mutateAsync(regionToDeleteData.id)

        // 消した分だけ後ろが繰り上がるので、残りの並び順を振り直す
        const remaining = regions.filter(
          (region) => region.id !== regionToDeleteData.id
        )
        if (remaining.length > 0) handleReorder(remaining)

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
        <Palette className="mx-auto mb-4 h-12 w-12 text-muted-foreground/70" />
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
    <div className="h-full overflow-auto p-6">
      <table className="w-full border-collapse border border-border">
        <thead>
          <tr className="bg-muted/50">
            <th className="w-8 border border-border px-2 py-1 text-left font-medium"></th>
            <th className="w-16 border border-border px-2 py-1 text-left font-medium">
              #
            </th>
            <th className="w-16 border border-border px-2 py-1 text-left font-medium">
              ページ
            </th>
            <th className="w-36 border border-border px-2 py-1 text-left font-medium">
              種類
            </th>
            <th className="w-40 border border-border px-2 py-1 text-left font-medium">
              ラベル
            </th>
            <th className="w-24 border border-border px-2 py-1 text-left font-medium">
              配点
            </th>
            <th className="w-16 border border-border px-2 py-1 text-center font-medium">
              OMR
            </th>
            <th className="w-20 border border-border px-2 py-1 text-center font-medium">
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
                omrConfig={getOmrConfig(region.id)}
                onOmrSave={onOmrSave}
                onOmrDelete={onOmrDelete}
                onRegionChange={handleRegionChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
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

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteRegion}
      />
    </div>
  )
}

export default RegionDetailsTable
