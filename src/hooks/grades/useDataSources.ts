import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"
import type {
  AbsentMethod,
  EstimationMode,
  GradeDataSourceInput,
} from "@/types/grade.types"

/** 未取得のときに毎回新しいオブジェクトを作らないための空値 */
const EMPTY_SOURCE_FITS: Record<
  string,
  { correlation: number; sampleSize: number } | null
> = {}

/** 成績評定項目とデータソースのCRUD操作を管理するフック */
export function useDataSources(gradeId: string) {
  const queryClient = useQueryClient()
  const detailKey = queryKeys.grade.detail(gradeId)
  const { data: exam = null, isPending: loading } = useQuery({
    queryKey: detailKey,
    queryFn: () => window.electronAPI.grade.getById(gradeId),
  })

  // R の算出は buildGradeCalcContext（全試験のスコア取得＋解決）を伴い重い。
  // 本体とは別のクエリにして後追いで反映し、「Rに影響する変更」のときだけ
  // 無効化する（名前・換算満点・並べ替え・評価項目リネームでは再算出しない）。
  const sourceFitsKey = queryKeys.grade.sourceFits(gradeId)
  const { data: sourceFits = EMPTY_SOURCE_FITS } = useQuery({
    queryKey: sourceFitsKey,
    queryFn: () => window.electronAPI.grade.computeSourceFits(gradeId),
  })

  const loadData = useCallback(
    () => queryClient.invalidateQueries({ queryKey: detailKey }),
    [queryClient, detailKey]
  )

  const loadSourceFits = useCallback(
    () => queryClient.invalidateQueries({ queryKey: sourceFitsKey }),
    [queryClient, sourceFitsKey]
  )

  const createGradeItem = useCallback(
    async (name: string) => {
      const gradeItem = await window.electronAPI.grade.createGradeItem({
        gradeId,
        name,
      })
      await loadData()
      return gradeItem
    },
    [gradeId, loadData]
  )

  const updateGradeItem = useCallback(
    async (id: string, name: string) => {
      const gradeItem = await window.electronAPI.grade.updateGradeItem(id, {
        name,
      })
      await loadData()
      return gradeItem
    },
    [loadData]
  )

  const deleteGradeItem = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.grade.deleteGradeItem(id)
      await loadData()
      // 評価項目削除は配下ソース（＝予測変数の集合）を減らすため R を再算出
      void loadSourceFits()
      return result
    },
    [loadData, loadSourceFits]
  )

  const reorderGradeItems = useCallback(
    async (gradeItemOrders: { id: string; order: number }[]) => {
      await window.electronAPI.grade.reorderGradeItems(gradeItemOrders)
      await loadData()
    },
    [loadData]
  )

  const createDataSource = useCallback(
    async (dataSourceInput: GradeDataSourceInput) => {
      const dataSource =
        await window.electronAPI.grade.createDataSource(dataSourceInput)
      await loadData()
      // ソース追加は予測変数/対象を増やすため R を再算出
      void loadSourceFits()
      return dataSource
    },
    [loadData, loadSourceFits]
  )

  const updateDataSource = useCallback(
    async (
      id: string,
      data: {
        name?: string
        weight?: number
        absentMethod?: string
        absentRatio?: number
        absentOffset?: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => {
      const dataSource = await window.electronAPI.grade.updateDataSource(
        id,
        data
      )
      await loadData()
      // 推定に影響する変更（推定法・ソース選択・見込→欠測）のときのみ R を再算出。
      // 名前・換算満点のみの編集では R は変わらないので重い再算出をしない。
      if (
        data.absentMethod !== undefined ||
        data.estimationMode !== undefined ||
        data.estimationSourceIds !== undefined ||
        data.treatExpectedAsMissing !== undefined
      ) {
        void loadSourceFits()
      }
      return dataSource
    },
    [loadData, loadSourceFits]
  )

  // 一括更新は専用IPCを持たず、普遍的な個別更新IPCをターゲット分だけ回す。
  // 自ソース除外などターゲットごとの差分は呼び出し側で組み立て済みの前提。
  //
  // 【設計判断】$transaction による原子性(all-or-nothing)は意図的に持たない。
  // 「一括適用」は同じ操作を各対象へ繰り返すだけの作業であり、部分適用が残っても
  // 意味が通り、再度「適用」を押せば回復できる（呼び出し側は失敗時に選択を保持し
  // 再適用可能にしている）。原子性のためだけに専用の一括IPC/トランザクションを
  // backendへ復活させないこと（普遍的な個別更新IPCのみを保つのが本設計の狙い）。
  const batchUpdateDataSources = useCallback(
    async (
      updates: {
        id: string
        data: {
          absentMethod?: AbsentMethod
          absentRatio?: number
          absentOffset?: number
          treatExpectedAsMissing?: boolean
          estimationMode?: EstimationMode
          estimationSourceIds?: string[]
        }
      }[]
    ) => {
      // 個別更新IPC(grade:updateDataSource)は失敗を reject で返す。allSettled で
      // 受けないと直後の loadData()/return に到達せず、呼び出し側の toast も
      // 再読込も走らないまま無反応になる。
      const results = await Promise.allSettled(
        updates.map((update) =>
          window.electronAPI.grade.updateDataSource(update.id, update.data)
        )
      )
      // 個別更新は独立にコミットされ、一部失敗でもDBは変わり得る。
      // UIを実DBへ追従させるため成否に関わらず必ず再読込する。
      await loadData()
      // 一括設定は推定法・ソース選択を変えるため R を再算出
      void loadSourceFits()
      return {
        failedCount: results.filter(
          (settledResult) => settledResult.status === "rejected"
        ).length,
      }
    },
    [loadData, loadSourceFits]
  )

  const deleteDataSource = useCallback(
    async (id: string) => {
      await window.electronAPI.grade.deleteDataSource(id)
      await loadData()
      // ソース削除は予測変数の集合を減らすため R を再算出
      void loadSourceFits()
    },
    [loadData, loadSourceFits]
  )

  const reorderDataSources = useCallback(
    async (items: { id: string; order: number }[]) => {
      await window.electronAPI.grade.reorderDataSources(items)
      await loadData()
    },
    [loadData]
  )

  return {
    exam,
    loading,
    sourceFits,
    createGradeItem,
    updateGradeItem,
    deleteGradeItem,
    reorderGradeItems,
    createDataSource,
    updateDataSource,
    batchUpdateDataSources,
    deleteDataSource,
    reorderDataSources,
    reload: loadData,
  }
}
