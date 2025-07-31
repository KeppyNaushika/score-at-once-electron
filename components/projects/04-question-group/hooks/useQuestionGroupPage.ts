"use client"

import { CropRegionWithDetails, SubtotalGroupWithItems } from "@/types/electron"
import { useCallback, useEffect, useState } from "react"

interface SubtotalData {
  [subtotalGroupId: string]: {
    [subtotalId: string]: {
      questions: string[]
      totalPoints: number
    }
  }
}

export function useQuestionGroupPage(projectId: string) {
  const [project, setProject] = useState<any>(null)
  const [subtotalGroups, setSubtotalGroups] = useState<
    SubtotalGroupWithItems[]
  >([])
  const [cropRegions, setCropRegions] = useState<CropRegionWithDetails[]>([])
  const [subtotalRegions, setSubtotalRegions] = useState<
    CropRegionWithDetails[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubtotalGroupId, setSelectedSubtotalGroupId] = useState<
    string | null
  >(null)
  const [subtotalData, setSubtotalData] = useState<SubtotalData | null>(null)

  // データ読み込み
  const loadData = useCallback(async () => {
    try {
      console.log("📥 loadData called for projectId:", projectId)
      setLoading(true)
      setError(null)

      const [projectResponse, subtotalGroupsResponse, cropRegionsResponse] =
        await Promise.all([
          window.electronAPI.fetchProjectById(projectId),
          window.electronAPI.getSubtotalGroupsByProjectId(projectId),
          window.electronAPI.getCropRegionsByProjectId(projectId),
        ])

      console.log("📊 subtotalGroupsResponse:", subtotalGroupsResponse)

      // 各グループの詳細を確認
      if (subtotalGroupsResponse && subtotalGroupsResponse.length > 0) {
        subtotalGroupsResponse.forEach((group: any, groupIndex: number) => {
          console.log(`📋 Group ${groupIndex + 1} (${group.name}):`, group)
          if (group.subtotals && group.subtotals.length > 0) {
            group.subtotals.forEach((subtotal: any, subtotalIndex: number) => {
              console.log(
                `  📝 Subtotal ${subtotalIndex + 1}: ${subtotal.name} (order: ${subtotal.order})`,
              )
            })
          }
        })
      }

      if (projectResponse) {
        setProject(projectResponse)
      }

      if (subtotalGroupsResponse) {
        setSubtotalGroups(subtotalGroupsResponse)
        if (subtotalGroupsResponse.length > 0 && !selectedSubtotalGroupId) {
          setSelectedSubtotalGroupId(subtotalGroupsResponse[0].id)
        }
      }

      if (cropRegionsResponse) {
        // 設問タイプの領域のみフィルタリング
        const questionRegions = cropRegionsResponse.filter(
          (region: CropRegionWithDetails) => region.type === "QUESTION_ANSWER",
        )
        setCropRegions(questionRegions)

        // 小計点タイプの領域のみフィルタリング
        const subtotalRegions = cropRegionsResponse.filter(
          (region: CropRegionWithDetails) => region.type === "SUBTOTAL_SCORE",
        )
        setSubtotalRegions(subtotalRegions)
      }

      console.log("✅ loadData completed successfully")
    } catch (err) {
      console.error("❌ loadData error:", err)
      setError(
        err instanceof Error ? err.message : "データの読み込みに失敗しました",
      )
    } finally {
      setLoading(false)
    }
  }, [projectId, selectedSubtotalGroupId])

  // 小計データを計算
  const calculateSubtotalData = useCallback(async () => {
    if (subtotalGroups.length === 0) return

    try {
      const data: SubtotalData = {}

      for (const group of subtotalGroups) {
        data[group.id] = {}

        for (const subtotal of group.subtotals) {
          // この subtotal に関連付けられた設問を取得
          try {
            const assignmentsResult =
              (await window.electronAPI.getAssignmentsByQuestionGroupItemId(
                subtotal.id,
              )) as any

            if (
              assignmentsResult &&
              assignmentsResult.success &&
              assignmentsResult.assignments
            ) {
              const questionLabels = assignmentsResult.assignments
                .map(
                  (assignment: any) =>
                    assignment.questionLayoutRegion?.label ||
                    `問${assignment.questionLayoutRegion?.orderIndex || 1}`,
                )
                .filter(Boolean)

              const totalPoints = assignmentsResult.assignments.reduce(
                (sum: number, assignment: any) =>
                  sum + (assignment.questionLayoutRegion?.points || 0),
                0,
              )

              data[group.id][subtotal.id] = {
                questions: questionLabels,
                totalPoints,
              }
            } else {
              data[group.id][subtotal.id] = {
                questions: [],
                totalPoints: 0,
              }
            }
          } catch (error) {
            data[group.id][subtotal.id] = {
              questions: [],
              totalPoints: 0,
            }
          }
        }
      }

      setSubtotalData(data)
    } catch (err) {
      console.error("小計データの計算に失敗しました:", err)
    }
  }, [subtotalGroups])

  // SubtotalGroup作成
  const createSubtotalGroup = useCallback(
    async (name: string) => {
      try {
        const result = await window.electronAPI.createQuestionGroup({
          name,
        })

        if (result) {
          await loadData()
          return true
        }
        return false
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "グループの作成に失敗しました",
        )
        return false
      }
    },
    [loadData],
  )

  // SubtotalGroup更新
  const updateSubtotalGroup = useCallback(
    async (id: string, name: string) => {
      try {
        const result = await window.electronAPI.updateQuestionGroup(id, {
          name,
        })

        if (result) {
          await loadData()
          return true
        }
        return false
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "グループの更新に失敗しました",
        )
        return false
      }
    },
    [loadData],
  )

  // SubtotalGroup削除
  const deleteSubtotalGroup = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.deleteQuestionGroup(id)
        await loadData()

        if (selectedSubtotalGroupId === id) {
          setSelectedSubtotalGroupId(null)
        }

        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "グループの削除に失敗しました",
        )
        return false
      }
    },
    [selectedSubtotalGroupId, loadData],
  )

  // Subtotal作成
  const createSubtotal = useCallback(
    async (subtotalGroupId: string, name: string) => {
      try {
        const result = await window.electronAPI.createQuestionGroupItem({
          name,
          subtotalGroupId,
        })

        if (result) {
          await loadData()
          return true
        }
        return false
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "項目の作成に失敗しました",
        )
        return false
      }
    },
    [loadData],
  )

  // Subtotal更新
  const updateSubtotal = useCallback(
    async (id: string, name: string) => {
      try {
        const result = await window.electronAPI.updateQuestionGroupItem(id, {
          name,
        })

        if (result) {
          await loadData()
          return true
        }
        return false
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "項目の更新に失敗しました",
        )
        return false
      }
    },
    [loadData],
  )

  // Subtotal削除
  const deleteSubtotal = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.deleteQuestionGroupItem(id)
        await loadData()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "項目の削除に失敗しました",
        )
        return false
      }
    },
    [loadData],
  )

  // Subtotal順序更新
  const updateSubtotalOrders = useCallback(
    async (orders: { id: string; order: number }[]) => {
      try {
        console.log("🔄 updateQuestionGroupItemOrders called with:", orders)
        const result =
          await window.electronAPI.updateQuestionGroupItemOrders(orders)
        console.log("✅ updateQuestionGroupItemOrders result:", result)

        console.log("🔄 Reloading data after order update...")
        await loadData()
        console.log("✅ Data reloaded successfully")

        return true
      } catch (err) {
        console.error("❌ updateQuestionGroupItemOrders error:", err)
        setError(
          err instanceof Error ? err.message : "順序の更新に失敗しました",
        )
        return false
      }
    },
    [loadData],
  )

  // 設問とサブトータルの関連付け更新
  const updateQuestionAssignments = useCallback(
    async (questionCropRegionId: string, subtotalIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteAssignmentsByQuestionLayoutRegionId(
          questionCropRegionId,
        )

        // 新しい関連付けを作成
        if (subtotalIds.length > 0) {
          const assignments = subtotalIds.map((subtotalId) => ({
            cropRegionId: questionCropRegionId,
            subtotalId,
            assignmentType: "QUESTION_SUBTOTAL" as const,
          }))

          await window.electronAPI.createManyQuestionSubtotalAssignments(
            assignments,
          )
        }

        await calculateSubtotalData()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "関連付けの更新に失敗しました",
        )
        return false
      }
    },
    [calculateSubtotalData],
  )

  // 小計点とサブトータルの関連付け更新
  const updateSubtotalAssignments = useCallback(
    async (subtotalCropRegionId: string, subtotalIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteCropSubtotalsByCropRegionId(
          subtotalCropRegionId,
        )

        // 新しい関連付けを作成
        if (subtotalIds.length > 0) {
          const cropSubtotals = subtotalIds.map((subtotalId) => ({
            cropRegionId: subtotalCropRegionId,
            subtotalId,
            assignmentType: "SUBTOTAL_DEFINITION" as const,
          }))

          await window.electronAPI.createManyCropSubtotals(cropSubtotals)
        }

        return true
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "小計点関連付けの更新に失敗しました",
        )
        return false
      }
    },
    [],
  )

  // 初期化
  useEffect(() => {
    loadData()
  }, [loadData])

  // 小計データの計算
  useEffect(() => {
    if (subtotalGroups.length > 0) {
      calculateSubtotalData()
    }
  }, [subtotalGroups, calculateSubtotalData])

  return {
    project,
    subtotalGroups,
    cropRegions,
    subtotalRegions,
    loading,
    error,
    selectedSubtotalGroupId,
    setSelectedSubtotalGroupId,
    refreshData: loadData,
    createSubtotalGroup,
    updateSubtotalGroup,
    deleteSubtotalGroup,
    createSubtotal,
    updateSubtotal,
    deleteSubtotal,
    updateSubtotalOrders,
    updateQuestionAssignments,
    updateSubtotalAssignments,
    subtotalData,
  }
}
