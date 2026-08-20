"use client"

import type { Subtotal } from "@prisma/client"
import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"

import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"
import {
  createCropSubtotalMutation,
  deleteCropSubtotalMutation,
} from "@/queries/subtotal"

import type { FillUpdate } from "./useFillHandleDrag"

interface UseCropSubtotalAssignmentsParams {
  examId: string
  /** この表が書き込む紐付けの種類 */
  assignmentType: CropSubtotalAssignmentType
}

/**
 * 設問割当マトリクスのマスの読み書き。
 *
 * **割り当ては採点領域の子（`cropRegion.cropSubtotals`）なので、別に取得も索引化も
 * しない。** マスを描く時点で行は手元にあるので、そこから直に読む。
 *
 * かつては小計id をキーにした索引を組んでいたが、それは「1マス＝1行」という
 * 一意性を仮定する形だった。CropSubtotal に `(cropRegionId, subtotalId,
 * assignmentType)` の unique がいま無いため、同期のマージで同じ割り当てが2行残りうる。
 * 索引は2行目を握り潰すので、チェックを外しても外れないマスができていた。
 *
 * 無いのは規約が禁じているからではない。規約は「uuid 以外を unique にしない」で、
 * この3列は uuid 2つと固定値の区分なので張ること自体は規約に反しない（張れば同期の
 * マージが LWW で1行へ畳む）。CropSubtotal は子を持たないので
 * docs/sync-secondary-unique-hazard.md §3 の詰まりにも当たらない。実際に張るかどうかは
 * 段階30 で判断する。
 *
 * **マス1つは1レコード。** チェックを入れれば1件作り、外せばそのマスに当たる行を
 * すべて消す（同じ事実の重複であって、2つの事実ではない）。
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

  /** そのマスに当たる割り当ての行。同期のマージで2行あることがある */
  const assignedRows = useCallback(
    (cropRegion: CropRegionWithSubtotals, subtotal: Subtotal) =>
      cropRegion.cropSubtotals.filter(
        (cropSubtotal) =>
          cropSubtotal.assignmentType === assignmentType &&
          cropSubtotal.subtotalId === subtotal.id
      ),
    [assignmentType]
  )

  /** そのマスにチェックが入っているか */
  const isAssigned = useCallback(
    (cropRegion: CropRegionWithSubtotals, subtotal: Subtotal) =>
      assignedRows(cropRegion, subtotal).length > 0,
    [assignedRows]
  )

  /** マス1つの割り当てを付け外しする。既にその姿なら何も書かない */
  const setCellAssignment = useCallback(
    async (
      cropRegion: CropRegionWithSubtotals,
      subtotal: Subtotal,
      checked: boolean
    ) => {
      const assigned = assignedRows(cropRegion, subtotal)
      try {
        if (checked) {
          if (assigned.length > 0) return
          await createAssignment({
            cropRegionId: cropRegion.id,
            subtotalId: subtotal.id,
            assignmentType,
          })
        } else {
          // 重複していれば全部消す。1行だけ消しても割り当ては残ってしまう
          await Promise.all(
            assigned.map((cropSubtotal) => deleteAssignment(cropSubtotal.id))
          )
        }
      } catch {
        // 失敗の通知は MutationCache が出す。ここで受けるのは、投げっぱなしの
        // 拒否を作らないため
      }
    },
    [assignedRows, assignmentType, createAssignment, deleteAssignment]
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
