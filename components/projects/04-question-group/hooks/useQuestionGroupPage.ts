"use client"

import { useState, useEffect, useCallback } from "react"
import {
  QuestionGroupWithItems,
  QuestionGroupItemWithDetails,
  LayoutRegionWithDetails,
} from "@/types/electron"

interface SubtotalData {
  [questionGroupId: string]: {
    [questionGroupItemId: string]: {
      questions: string[]
      totalPoints: number
    }
  }
}

export function useQuestionGroupPage(projectId: string) {
  const [project, setProject] = useState<any>(null)
  const [questionGroups, setQuestionGroups] = useState<
    QuestionGroupWithItems[]
  >([])
  const [layoutRegions, setLayoutRegions] = useState<LayoutRegionWithDetails[]>(
    [],
  )
  const [subtotalRegions, setSubtotalRegions] = useState<LayoutRegionWithDetails[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestionGroupId, setSelectedQuestionGroupId] = useState<
    string | null
  >(null)
  const [subtotalData, setSubtotalData] = useState<SubtotalData | null>(null)

  // データ読み込み
  const loadData = useCallback(async () => {
    try {
      console.log("📥 loadData called for projectId:", projectId)
      setLoading(true)
      setError(null)

      const [projectResponse, questionGroupsResponse, layoutRegionsResponse] =
        await Promise.all([
          window.electronAPI.fetchProjectById(projectId),
          window.electronAPI.getQuestionGroupsByProjectId(projectId),
          window.electronAPI.getLayoutRegionsByProjectId(projectId),
        ])

      console.log("📊 questionGroupsResponse:", questionGroupsResponse)
      
      // 各グループの詳細を確認
      if (questionGroupsResponse && questionGroupsResponse.length > 0) {
        questionGroupsResponse.forEach((group: any, groupIndex: number) => {
          console.log(`📋 Group ${groupIndex + 1} (${group.name}):`, group)
          if (group.items && group.items.length > 0) {
            group.items.forEach((item: any, itemIndex: number) => {
              console.log(`  📝 Item ${itemIndex + 1}: ${item.name} (order: ${item.order})`)
            })
          }
        })
      }

      if (projectResponse) {
        setProject(projectResponse)
      }

      if (questionGroupsResponse) {
        setQuestionGroups(questionGroupsResponse)
        if (questionGroupsResponse.length > 0 && !selectedQuestionGroupId) {
          setSelectedQuestionGroupId(questionGroupsResponse[0].id)
        }
      }

      if (layoutRegionsResponse) {
        // 設問タイプの領域のみフィルタリング
        const questionRegions = layoutRegionsResponse.filter(
          (region: LayoutRegionWithDetails) =>
            region.type === "QUESTION_ANSWER",
        )
        setLayoutRegions(questionRegions)
        
        // 小計点タイプの領域のみフィルタリング
        const subtotalRegions = layoutRegionsResponse.filter(
          (region: LayoutRegionWithDetails) =>
            region.type === "SUBTOTAL_SCORE",
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
  }, [projectId, selectedQuestionGroupId])

  // 小計データを計算
  const calculateSubtotalData = useCallback(async () => {
    if (questionGroups.length === 0) return

    try {
      const data: SubtotalData = {}

      for (const group of questionGroups) {
        data[group.id] = {}

        for (const item of group.items) {
          // この item に関連付けられた設問を取得
          try {
            const assignmentsResult =
              (await window.electronAPI.getAssignmentsByQuestionGroupItemId(
                item.id,
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

              data[group.id][item.id] = {
                questions: questionLabels,
                totalPoints,
              }
            } else {
              data[group.id][item.id] = {
                questions: [],
                totalPoints: 0,
              }
            }
          } catch (error) {
            data[group.id][item.id] = {
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
  }, [questionGroups])

  // QuestionGroup作成
  const createQuestionGroup = useCallback(
    async (name: string) => {
      try {
        const result = await window.electronAPI.createQuestionGroup({
          name,
          projectId,
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
    [projectId, loadData],
  )

  // QuestionGroup更新
  const updateQuestionGroup = useCallback(
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

  // QuestionGroup削除
  const deleteQuestionGroup = useCallback(
    async (id: string) => {
      try {
        await window.electronAPI.deleteQuestionGroup(id)
        await loadData()

        if (selectedQuestionGroupId === id) {
          setSelectedQuestionGroupId(null)
        }

        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "グループの削除に失敗しました",
        )
        return false
      }
    },
    [selectedQuestionGroupId, loadData],
  )

  // QuestionGroupItem作成
  const createQuestionGroupItem = useCallback(
    async (questionGroupId: string, name: string) => {
      try {
        const result = await window.electronAPI.createQuestionGroupItem({
          name,
          questionGroupId,
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

  // QuestionGroupItem更新
  const updateQuestionGroupItem = useCallback(
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

  // QuestionGroupItem削除
  const deleteQuestionGroupItem = useCallback(
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

  // QuestionGroupItem順序更新
  const updateQuestionGroupItemOrders = useCallback(
    async (orders: { id: string; order: number }[]) => {
      try {
        console.log("🔄 updateQuestionGroupItemOrders called with:", orders)
        const result = await window.electronAPI.updateQuestionGroupItemOrders(orders)
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

  // 設問とグループの関連付け更新
  const updateQuestionAssignments = useCallback(
    async (questionLayoutRegionId: string, questionGroupItemIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteAssignmentsByQuestionLayoutRegionId(
          questionLayoutRegionId,
        )

        // 新しい関連付けを作成
        if (questionGroupItemIds.length > 0) {
          const assignments = questionGroupItemIds.map(
            (questionGroupItemId) => ({
              questionLayoutRegionId,
              questionGroupItemId,
            }),
          )

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

  // 小計点とグループの関連付け更新
  const updateSubtotalAssignments = useCallback(
    async (subtotalLayoutRegionId: string, questionGroupItemIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteSubtotalDefinitionsByLayoutRegionId(
          subtotalLayoutRegionId,
        )

        // 新しい関連付けを作成
        if (questionGroupItemIds.length > 0) {
          const definitions = questionGroupItemIds.map(
            (questionGroupItemId) => ({
              layoutRegionId: subtotalLayoutRegionId,
              questionGroupItemId,
            }),
          )

          await window.electronAPI.createManySubtotalDefinitions(definitions)
        }

        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "小計点関連付けの更新に失敗しました",
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
    if (questionGroups.length > 0) {
      calculateSubtotalData()
    }
  }, [questionGroups, calculateSubtotalData])

  return {
    project,
    questionGroups,
    layoutRegions,
    subtotalRegions,
    loading,
    error,
    selectedQuestionGroupId,
    setSelectedQuestionGroupId,
    refreshData: loadData,
    createQuestionGroup,
    updateQuestionGroup,
    deleteQuestionGroup,
    createQuestionGroupItem,
    updateQuestionGroupItem,
    deleteQuestionGroupItem,
    updateQuestionGroupItemOrders,
    updateQuestionAssignments,
    updateSubtotalAssignments,
    subtotalData,
  }
}
