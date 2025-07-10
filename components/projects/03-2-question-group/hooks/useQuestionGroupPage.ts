"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  QuestionGroupWithItems, 
  QuestionGroupItemWithDetails,
  LayoutRegionWithDetails 
} from "../../../../types/electron"

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
  const [questionGroups, setQuestionGroups] = useState<QuestionGroupWithItems[]>([])
  const [layoutRegions, setLayoutRegions] = useState<LayoutRegionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestionGroupId, setSelectedQuestionGroupId] = useState<string | null>(null)
  const [subtotalData, setSubtotalData] = useState<SubtotalData | null>(null)

  // データ読み込み
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [projectResponse, questionGroupsResponse, layoutRegionsResponse] = await Promise.all([
        window.electronAPI.fetchProjectById(projectId),
        window.electronAPI.getQuestionGroupsByProjectId(projectId),
        window.electronAPI.getLayoutRegionsByProjectId(projectId)
      ])

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
          (region: LayoutRegionWithDetails) => region.type === "QUESTION_ANSWER"
        )
        setLayoutRegions(questionRegions)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました")
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
            const assignmentsResult = await window.electronAPI.getAssignmentsByQuestionGroupItemId(item.id) as any
            
            if (assignmentsResult && assignmentsResult.success && assignmentsResult.assignments) {
              const questionNumbers = assignmentsResult.assignments.map(
                (assignment: any) => assignment.questionLayoutRegion?.questionNumber || assignment.questionLayoutRegion?.label
              ).filter(Boolean)
              
              const totalPoints = assignmentsResult.assignments.reduce(
                (sum: number, assignment: any) => sum + (assignment.questionLayoutRegion?.points || 0),
                0
              )
              
              data[group.id][item.id] = {
                questions: questionNumbers,
                totalPoints
              }
            } else {
              data[group.id][item.id] = {
                questions: [],
                totalPoints: 0
              }
            }
          } catch (error) {
            data[group.id][item.id] = {
              questions: [],
              totalPoints: 0
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
  const createQuestionGroup = useCallback(async (name: string) => {
    try {
      const result = await window.electronAPI.createQuestionGroup({
        name,
        projectId
      })
      
      if (result) {
        await loadData()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : "グループの作成に失敗しました")
      return false
    }
  }, [projectId, loadData])

  // QuestionGroup更新
  const updateQuestionGroup = useCallback(async (id: string, name: string) => {
    try {
      const result = await window.electronAPI.updateQuestionGroup(id, { name })
      
      if (result) {
        await loadData()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : "グループの更新に失敗しました")
      return false
    }
  }, [loadData])

  // QuestionGroup削除
  const deleteQuestionGroup = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteQuestionGroup(id)
      await loadData()
      
      if (selectedQuestionGroupId === id) {
        setSelectedQuestionGroupId(null)
      }
      
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "グループの削除に失敗しました")
      return false
    }
  }, [selectedQuestionGroupId, loadData])

  // QuestionGroupItem作成
  const createQuestionGroupItem = useCallback(async (questionGroupId: string, name: string) => {
    try {
      const result = await window.electronAPI.createQuestionGroupItem({
        name,
        questionGroupId
      })
      
      if (result) {
        await loadData()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : "項目の作成に失敗しました")
      return false
    }
  }, [loadData])

  // QuestionGroupItem更新
  const updateQuestionGroupItem = useCallback(async (id: string, name: string) => {
    try {
      const result = await window.electronAPI.updateQuestionGroupItem(id, { name })
      
      if (result) {
        await loadData()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : "項目の更新に失敗しました")
      return false
    }
  }, [loadData])

  // QuestionGroupItem削除
  const deleteQuestionGroupItem = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteQuestionGroupItem(id)
      await loadData()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "項目の削除に失敗しました")
      return false
    }
  }, [loadData])

  // 設問とグループの関連付け更新
  const updateQuestionAssignments = useCallback(async (
    questionLayoutRegionId: string,
    questionGroupItemIds: string[]
  ) => {
    try {
      // 既存の関連付けを削除
      await window.electronAPI.deleteAssignmentsByQuestionLayoutRegionId(questionLayoutRegionId)
      
      // 新しい関連付けを作成
      if (questionGroupItemIds.length > 0) {
        const assignments = questionGroupItemIds.map(questionGroupItemId => ({
          questionLayoutRegionId,
          questionGroupItemId
        }))
        
        await window.electronAPI.createManyQuestionSubtotalAssignments(assignments)
      }
      
      await calculateSubtotalData()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "関連付けの更新に失敗しました")
      return false
    }
  }, [calculateSubtotalData])

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
    updateQuestionAssignments,
    subtotalData,
  }
}