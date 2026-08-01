import { useCallback, useEffect, useState } from "react"

import type {
  AbsentMethod,
  EstimationMode,
  GradeWithRelations,
} from "@/types/grade.types"

/** 各データソースのモデル適合度 R（このソースが他ソースからどれだけ当てられるか） */
type SourceFitMap = Record<
  string,
  { correlation: number; sampleSize: number } | null
>

/** 成績評定項目とデータソースのCRUD操作を管理するフック */
export function useDataSources(gradeId: string) {
  const [exam, setExam] = useState<GradeWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  // モデル適合度Rは重い算出のため本体読込と切り離し、非同期に後追いで反映する
  const [sourceFits, setSourceFits] = useState<SourceFitMap>({})

  const loadSourceFits = useCallback(async () => {
    try {
      const result = await window.electronAPI.grade.computeSourceFits(gradeId)
      if (result.success && result.fits) {
        setSourceFits(result.fits)
      }
    } catch (error) {
      console.error("Error computing source fits:", error)
    }
  }, [gradeId])

  const loadData = useCallback(async () => {
    try {
      const gpResult = await window.electronAPI.grade.getById(gradeId)
      if (gpResult.success && gpResult.grade) {
        setExam(gpResult.grade)
      }
    } catch (error) {
      console.error("Error loading data sources:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // R の再算出は buildGradeCalcContext（全試験のスコア取得＋解決）を伴い重いため、
  // loadData には載せず初回マウントと「Rに影響する変更」のみで走らせる（名前・換算満点・
  // 並べ替え・評価項目リネームでは再算出しない）。
  useEffect(() => {
    void loadSourceFits()
  }, [loadSourceFits])

  const createGradeItem = useCallback(
    async (name: string) => {
      const result = await window.electronAPI.grade.createGradeItem({
        gradeId,
        name,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [gradeId, loadData]
  )

  const updateGradeItem = useCallback(
    async (id: string, name: string) => {
      const result = await window.electronAPI.grade.updateGradeItem(id, {
        name,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const deleteGradeItem = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.grade.deleteGradeItem(id)
      if (result.success) {
        await loadData()
        // 評価項目削除は配下ソース（＝予測変数の集合）を減らすため R を再算出
        void loadSourceFits()
      }
      return result
    },
    [loadData, loadSourceFits]
  )

  const reorderGradeItems = useCallback(
    async (gradeItemOrders: { id: string; order: number }[]) => {
      const result =
        await window.electronAPI.grade.reorderGradeItems(gradeItemOrders)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const createDataSource = useCallback(
    async (data: {
      gradeItemId: string
      type: string
      examId?: string
      subtotalId?: string
      cropRegionId?: string
      courseworkItemId?: string
      courseworkId?: string
      name: string
      weight: number
    }) => {
      const result = await window.electronAPI.grade.createDataSource(data)
      if (result.success) {
        await loadData()
        // ソース追加は予測変数/対象を増やすため R を再算出
        void loadSourceFits()
      }
      return result
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
      const result = await window.electronAPI.grade.updateDataSource(id, data)
      if (result.success) {
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
      }
      return result
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
      // 個別更新IPC(grade:updateDataSource)は registerHandler 登録のため、
      // backend例外時は reject する。allSettled で reject を吸収しないと
      // 直後の loadData()/return に到達せず、呼び出し側の toast も再読込も
      // 走らないまま無反応になる。allSettled なら reject も「失敗した1件」
      // として畳み込め、下の「必ず再読込」の不変条件を守れる。
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
        success: results.every(
          (settledResult) =>
            settledResult.status === "fulfilled" && settledResult.value.success
        ),
      }
    },
    [loadData, loadSourceFits]
  )

  const deleteDataSource = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.grade.deleteDataSource(id)
      if (result.success) {
        await loadData()
        // ソース削除は予測変数の集合を減らすため R を再算出
        void loadSourceFits()
      }
      return result
    },
    [loadData, loadSourceFits]
  )

  const reorderDataSources = useCallback(
    async (items: { id: string; order: number }[]) => {
      const result = await window.electronAPI.grade.reorderDataSources(items)
      if (result.success) {
        await loadData()
      }
      return result
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
