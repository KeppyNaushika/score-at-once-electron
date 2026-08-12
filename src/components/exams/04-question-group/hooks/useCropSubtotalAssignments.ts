"use client"

import { useCallback, useMemo, useState } from "react"

import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"

import type { FillUpdate } from "./useFillHandleDrag"

/** 採点領域（CropRegion.id）→ 割り当てた小計id の集合 */
export type CropSubtotalAssignmentState = Record<string, ReadonlySet<string>>

interface UseCropSubtotalAssignmentsParams {
  /** マトリクスの行になる採点領域。割り当ての出所でもある */
  cropRegions: CropRegionWithSubtotals[]
  /** この行が書き込む紐付けの種類 */
  assignmentType: CropSubtotalAssignmentType
  /** 1領域分の割り当てを丸ごと差し替える。失敗は throw する */
  onUpdateAssignments: (
    cropRegionId: string,
    subtotalIds: string[],
    assignmentType: CropSubtotalAssignmentType
  ) => Promise<void>
}

/**
 * 設問割当マトリクスの割り当て状態を扱う。
 *
 * **割り当ては採点領域の子（`cropRegion.cropSubtotals`）なので、別に取得しない。**
 * 以前はマス目ごとに `getCropSubtotalsByCropRegionId` を引いて別のキャッシュに
 * 持っていたため、(1) 1領域の取得失敗で全マスが「未チェック」に見え、そこでの
 * クリックが delete-all→recreate で既存の割り当てを消す、(2) 楽観更新した集合が
 * レンダー時の値から作り直されて累積しない、という2つの壊れ方をしていた。
 *
 * 書き込みは常に「その領域の割り当て集合を丸ごと差し替える」形にする（保存が
 * delete-all→recreate なので、部分更新という概念が無い）。フィルハンドルは
 * 1行分のマスを全て畳んでから1回だけ書く。
 */
export function useCropSubtotalAssignments({
  cropRegions,
  assignmentType,
  onUpdateAssignments,
}: UseCropSubtotalAssignmentsParams) {
  const [saving, setSaving] = useState(false)

  const assignments: CropSubtotalAssignmentState = useMemo(
    () =>
      Object.fromEntries(
        cropRegions.map((cropRegion) => [
          cropRegion.id,
          new Set(
            cropRegion.cropSubtotals
              .filter(
                (cropSubtotal) => cropSubtotal.assignmentType === assignmentType
              )
              .map((cropSubtotal) => cropSubtotal.subtotalId)
          ),
        ])
      ),
    [cropRegions, assignmentType]
  )

  /** 1領域分の集合に足し引きした結果を配列で返す */
  const nextSubtotalIds = useCallback(
    (cropRegionId: string, changes: ReadonlyMap<string, boolean>) => {
      const next = new Set(assignments[cropRegionId] ?? [])
      for (const [subtotalId, checked] of changes) {
        if (checked) next.add(subtotalId)
        else next.delete(subtotalId)
      }
      return Array.from(next)
    },
    [assignments]
  )

  /** マス1つのチェックを切り替える */
  const setCellAssignment = useCallback(
    async (cropRegionId: string, subtotalId: string, checked: boolean) => {
      setSaving(true)
      try {
        await onUpdateAssignments(
          cropRegionId,
          nextSubtotalIds(cropRegionId, new Map([[subtotalId, checked]])),
          assignmentType
        )
      } catch {
        // 巻き戻しと通知は onUpdateAssignments が行う
      } finally {
        setSaving(false)
      }
    },
    [assignmentType, nextSubtotalIds, onUpdateAssignments]
  )

  /**
   * フィルハンドルで塗った範囲を保存する。
   *
   * マスごとに書くと、同じ行の2マス目が1マス目より前の集合を元に組み立てられて
   * 上書きしてしまう。行ごとに畳んでから1回だけ書く。
   */
  const fillCells = useCallback(
    async (updates: FillUpdate[]) => {
      const changesByRegion = new Map<string, Map<string, boolean>>()
      for (const update of updates) {
        const changes = changesByRegion.get(update.rowId) ?? new Map()
        changes.set(update.colId, update.value)
        changesByRegion.set(update.rowId, changes)
      }

      setSaving(true)
      try {
        for (const [cropRegionId, changes] of changesByRegion) {
          await onUpdateAssignments(
            cropRegionId,
            nextSubtotalIds(cropRegionId, changes),
            assignmentType
          )
        }
      } catch {
        // 1行目で失敗したら残りは書かない（巻き戻しと通知は呼び出し先）
      } finally {
        setSaving(false)
      }
    },
    [assignmentType, nextSubtotalIds, onUpdateAssignments]
  )

  return { assignments, saving, setCellAssignment, fillCells }
}
