"use client"

import type { Subtotal } from "@prisma/client"
import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"

import type { FillUpdate } from "@/components/exams/shared/useFillHandleDrag"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"
import {
  createCropSubtotalMutation,
  deleteCropSubtotalMutation,
} from "@/queries/subtotal"

interface UseCropSubtotalAssignmentsParams {
  examId: string
  /** この表が書き込む紐付けの種類 */
  assignmentType: CropSubtotalAssignmentType
}

/**
 * 設問割当の対応表のマスの読み書き。
 *
 * **割り当ては採点領域の子（`cropRegion.cropSubtotals`）なので、別に取得も索引化も
 * しない。** マスを描く時点で行は手元にあるので、そこから直に読む。
 *
 * **マス1つは1レコード。** `(cropRegionId, subtotalId, assignmentType)` は
 * 2026-08-23 に unique を張った（`20260823120000_subtotal_uniques_by_uuid`）ので、
 * そのマスに当たる行は在るか無いかのどちらかで、2行にはならない。鍵は uuid 2つと
 * 閉じた語彙の区分なので、2端末が同じ行を作るのは「同じマスに2人がチェックを入れた」
 * ときだけ＝同期のマージが LWW で1行へ畳むのが正しい。
 *
 * それまでは同じ割り当てが2行残りえたので、ここが読むたびに畳んでいた
 * （さらにその前は小計id をキーにした索引を組んでおり、2行目を握り潰すので
 * チェックを外しても外れないマスができていた）。
 */
export function useCropSubtotalAssignments({
  examId,
  assignmentType,
}: UseCropSubtotalAssignmentsParams) {
  const createCropSubtotal = useMutation(createCropSubtotalMutation(examId))
  const deleteCropSubtotal = useMutation(deleteCropSubtotalMutation(examId))
  // 依存へ入れるのは `mutateAsync`。`useMutation` の戻り値は毎レンダー新しい
  // オブジェクトなので、まるごと入れるとコールバックが毎レンダー別物になる
  const { mutateAsync: createAssignment } = createCropSubtotal
  const { mutateAsync: deleteAssignment } = deleteCropSubtotal

  /** そのマスに当たる割り当ての行（unique なので在れば1行） */
  const assignedRow = useCallback(
    (cropRegion: CropRegionWithSubtotals, subtotal: Subtotal) =>
      cropRegion.cropSubtotals.find(
        (cropSubtotal) =>
          cropSubtotal.assignmentType === assignmentType &&
          cropSubtotal.subtotalId === subtotal.id
      ),
    [assignmentType]
  )

  /** そのマスにチェックが入っているか */
  const isAssigned = useCallback(
    (cropRegion: CropRegionWithSubtotals, subtotal: Subtotal) =>
      assignedRow(cropRegion, subtotal) !== undefined,
    [assignedRow]
  )

  /** マス1つの割り当てを付け外しする。既にその姿なら何も書かない */
  const setCellAssignment = useCallback(
    async (
      cropRegion: CropRegionWithSubtotals,
      subtotal: Subtotal,
      checked: boolean
    ) => {
      const assigned = assignedRow(cropRegion, subtotal)
      try {
        if (checked) {
          if (assigned) return
          await createAssignment({
            cropRegionId: cropRegion.id,
            subtotalId: subtotal.id,
            assignmentType,
          })
        } else {
          if (!assigned) return
          await deleteAssignment(assigned.id)
        }
      } catch {
        // 失敗の通知は MutationCache が出す。ここで受けるのは、投げっぱなしの
        // 拒否を作らないため
      }
    },
    [assignedRow, assignmentType, createAssignment, deleteAssignment]
  )

  /**
   * フィルハンドルで塗った範囲を保存する。
   *
   * マスごとに1レコードなので、塗った分だけ書く。**1つずつ待たない**のは、
   * `scope` が実行を直列にしつつ、順番待ちの間も pending として数えられるため。
   * `queryClient` の取り直しの畳み込みが効き、最後の1件だけが取り直す。
   */
  const fillCells = useCallback(
    async (
      updates: FillUpdate<CropRegionWithSubtotals, Subtotal>[]
    ): Promise<void> => {
      await Promise.all(
        updates.map((update) =>
          setCellAssignment(update.row, update.col, update.value)
        )
      )
    },
    [setCellAssignment]
  )

  return {
    isAssigned,
    saving: createCropSubtotal.isPending || deleteCropSubtotal.isPending,
    setCellAssignment,
    fillCells,
  }
}
