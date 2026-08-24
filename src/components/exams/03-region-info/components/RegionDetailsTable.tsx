"use client"

import { useMutation } from "@tanstack/react-query"
import { Palette } from "lucide-react"
import { useCallback, useState } from "react"

import { DeleteConfirmModal } from "@/components/exams/03-region-info/components/DeleteConfirmModal"
import { RegionTableRow } from "@/components/exams/03-region-info/components/RegionTableRow"
import { useDragAndDrop } from "@/components/exams/03-region-info/hooks/useDragAndDrop"
import { useKeyboardNavigation } from "@/components/exams/03-region-info/hooks/useKeyboardNavigation"
import { useEditingText } from "@/hooks/useEditingText"
import type { CropRegionRow } from "@/queries/cropRegion"
import {
  deleteCropRegionMutation,
  updateCropRegionMutation,
  updateCropRegionOrdersMutation,
} from "@/queries/cropRegion"
import type { CropRegionOmrConfigWithOptions } from "@/types/omr.types"

type RegionDetailsTableProps = {
  examId: string
  regions: CropRegionRow[]
  disabled?: boolean
  /** 選択中の採点領域。**添字ではなく id で持つ**（取り直しで並びが変わるため） */
  selectedCropRegionId: string | null
  onSelectCropRegion: (cropRegionId: string | null) => void
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
  selectedCropRegionId,
  onSelectCropRegion,
  getOmrConfig,
  onOmrSave,
  onOmrDelete,
}: RegionDetailsTableProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  // 消す相手は id で覚える。添字で覚えると、モーダルを開いてから確定するまでに
  // 取り直しが挟まったとき**別の領域を消す**
  const [cropRegionIdToDelete, setCropRegionIdToDelete] = useState<
    string | null
  >(null)

  // 1打鍵ごとに書くので、打鍵と取り直しが競り合う。入力中の文字は手元に持つ
  const { textOf, remember, forgetField, forget } = useEditingText()
  const updateCropRegion = useMutation(updateCropRegionMutation(examId))
  const deleteCropRegion = useMutation(deleteCropRegionMutation(examId))
  const updateCropRegionOrders = useMutation(
    updateCropRegionOrdersMutation(examId)
  )

  /** 並べ替え。順番は行の並びそのものなので、全行の orderIndex を振り直す */
  const handleReorder = useCallback(
    (reordered: CropRegionRow[]) => {
      updateCropRegionOrders.mutate(
        reordered.map((region, index) => ({
          id: region.id,
          orderIndex: index,
        }))
      )
    },
    [updateCropRegionOrders]
  )

  // 表は全ページの領域を統一順序で出す（ページで絞らない）
  const { handleKeyDown, handleCompositionStart, handleCompositionEnd } =
    useKeyboardNavigation({ regions })
  const {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop({ regions, onReorder: handleReorder })

  const handleRegionChange = (
    cropRegionId: string,
    field: string,
    value: string | number | null
  ) => {
    // 配点だけ数値。空欄は「未設定」なので null へ倒す
    remember(cropRegionId, field, value === null ? "" : String(value))

    const nextValue =
      field === "points"
        ? value === "" || value === null
          ? null
          : parseFloat(String(value))
        : value
    // 数にできない途中（空・`8.`）は書かない。次の打鍵で確定する
    if (field === "points" && nextValue !== null && Number.isNaN(nextValue))
      return

    updateCropRegion.mutate({ id: cropRegionId, data: { [field]: nextValue } })
  }

  const handleDeleteRegion = (cropRegionId: string) => {
    setCropRegionIdToDelete(cropRegionId)
    setDeleteModalOpen(true)
  }

  const confirmDeleteRegion = async () => {
    if (cropRegionIdToDelete === null) return

    try {
      forget(cropRegionIdToDelete)
      await deleteCropRegion.mutateAsync(cropRegionIdToDelete)

      // 消した分だけ後ろが繰り上がるので、残りの並び順を振り直す
      const remaining = regions.filter(
        (region) => region.id !== cropRegionIdToDelete
      )
      if (remaining.length > 0) handleReorder(remaining)
    } catch (error) {
      console.error("Error deleting layout region:", error)
      // エラーが発生した場合はモーダルは閉じるが、データは削除しない
    } finally {
      // 選択は id で持っているので、消えた領域を指したままでもどこも光らない。
      // 添字のときのような「後ろの領域へ選択がずれる」直しは要らない
      setDeleteModalOpen(false)
      setCropRegionIdToDelete(null)
    }
  }

  if (regions.length === 0) {
    return (
      <div className="p-8 text-center">
        <Palette className="mx-auto mb-4 h-12 w-12 text-muted-foreground/70" />
        {/*
          表はページで絞らないので「このページに領域がありません」は嘘になる
          （出るのは試験ぜんぶで領域が0件のときだけ）。1つの言い方に寄せる
        */}
        <h3 className="mb-2 text-lg font-medium">領域を作成してください</h3>
        <p className="text-muted-foreground">
          前のステップに戻って、模範解答上で領域を作成してください。
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
          {regions.map((region, globalIndex) => {
            const isSelected = selectedCropRegionId === region.id
            const isDragged = dragState.draggedIndex === globalIndex
            const isDraggedOver = dragState.dragOverIndex === globalIndex

            return (
              <RegionTableRow
                key={region.id}
                region={region}
                globalIndex={globalIndex}
                isSelected={isSelected}
                isDragged={isDragged}
                isDraggedOver={isDraggedOver}
                disabled={disabled}
                omrConfig={getOmrConfig(region.id)}
                onOmrSave={onOmrSave}
                onOmrDelete={onOmrDelete}
                textOf={textOf}
                onRegionChange={handleRegionChange}
                onRegionBlur={forgetField}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onDelete={handleDeleteRegion}
                onSelect={onSelectCropRegion}
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
