"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"
import {
  createCropSubtotalMutation,
  deleteCropSubtotalMutation,
} from "@/queries/subtotal"

import type { FillUpdate } from "./useFillHandleDrag"

/** 割り当ての行そのもの。採点領域に子として同梱されてくる */
type CropSubtotalRow = CropRegionWithSubtotals["cropSubtotals"][number]

/** 採点領域（CropRegion.id）→ 小計id → 割り当ての行 */
export type CropSubtotalAssignmentState = Record<
  string,
  ReadonlyMap<string, CropSubtotalRow>
>

interface UseCropSubtotalAssignmentsParams {
  examId: string
  /** マトリクスの行になる採点領域。割り当ての出所でもある */
  cropRegions: CropRegionWithSubtotals[]
  /** この表が書き込む紐付けの種類 */
  assignmentType: CropSubtotalAssignmentType
}

/**
 * 設問割当マトリクスの割り当て状態を扱う。
 *
 * **割り当ては採点領域の子（`cropRegion.cropSubtotals`）なので、別に取得しない。**
 * 以前はマス目ごとに `getCropSubtotalsByCropRegionId` を引いて別のキャッシュに
 * 持っていたため、(1) 1領域の取得失敗で全マスが「未チェック」に見え、そこでの
 * クリックが既存の割り当てを消す、(2) 楽観更新した集合がレンダー時の値から
 * 作り直されて累積しない、という2つの壊れ方をしていた。
 *
 * **マス1つは1レコード。** チェックを入れれば1件作り、外せば1件消す。以前は
 * 「その領域の割り当てを全消し→作り直し」で表していたが、それは意図（このマス
 * を切り替えた）ではなく状態（結果の集合）を送る形で、1マス触るだけで残りが
 * 一度 DB から消えていた。消す先を id で指せるのは、行そのものを持っているため。
 */
export function useCropSubtotalAssignments({
  examId,
  cropRegions,
  assignmentType,
}: UseCropSubtotalAssignmentsParams) {
  const createCropSubtotal = useMutation(createCropSubtotalMutation(examId))
  const deleteCropSubtotal = useMutation(deleteCropSubtotalMutation(examId))
  // 依存へ入れるのは `mutateAsync`。`useMutation` の戻り値は毎レンダー新しい
  // オブジェクトなので、まるごと入れるとコールバックが毎レンダー別物になる
  const { mutateAsync: createAssignment } = createCropSubtotal
  const { mutateAsync: deleteAssignment } = deleteCropSubtotal

  const assignments: CropSubtotalAssignmentState = useMemo(
    () =>
      Object.fromEntries(
        cropRegions.map((cropRegion) => [
          cropRegion.id,
          new Map(
            cropRegion.cropSubtotals
              .filter(
                (cropSubtotal) => cropSubtotal.assignmentType === assignmentType
              )
              .map((cropSubtotal) => [cropSubtotal.subtotalId, cropSubtotal])
          ),
        ])
      ),
    [cropRegions, assignmentType]
  )

  /** マス1つの割り当てを付け外しする。既にその姿なら何も書かない */
  const setCellAssignment = useCallback(
    async (cropRegionId: string, subtotalId: string, checked: boolean) => {
      const assigned = assignments[cropRegionId]?.get(subtotalId)
      try {
        if (checked) {
          if (assigned) return
          await createAssignment({ cropRegionId, subtotalId, assignmentType })
        } else {
          if (!assigned) return
          await deleteAssignment(assigned.id)
        }
      } catch {
        // 失敗の通知は MutationCache が出す。ここで受けるのは、投げっぱなしの
        // 拒否を作らないため
      }
    },
    [assignments, assignmentType, createAssignment, deleteAssignment]
  )

  /**
   * フィルハンドルで塗った範囲を保存する。
   *
   * マスごとに1レコードなので、塗った分だけ順に書く。範囲の中に既にその姿の
   * マスがあれば `setCellAssignment` が黙って飛ばす。
   */
  const fillCells = useCallback(
    async (updates: FillUpdate[]) => {
      for (const update of updates) {
        await setCellAssignment(update.rowId, update.colId, update.value)
      }
    },
    [setCellAssignment]
  )

  return {
    assignments,
    saving: createCropSubtotal.isPending || deleteCropSubtotal.isPending,
    setCellAssignment,
    fillCells,
  }
}
