import { 
  getSubtotalDefinitionsByLayoutRegionId,
  getAssignmentsByQuestionGroupItemId 
} from "../../prisma/questionGroup"

// 小計点計算で使用する型定義
export interface ScoreDetail {
  questionId: string
  score: number | null
  maxScore: number
  status?: string
}

export interface SubtotalResult {
  score: number
  maxScore: number
}

export interface SubtotalTargetMap {
  [subtotalRegionId: string]: number[]
}

/**
 * 設問が小計点の対象かチェックする関数（詳細版）
 * GROUP内OR、GROUP間ANDのロジックを実装
 */
export async function checkIfQuestionIsInSubtotal(
  questionId: string, 
  subtotalRegionId: string
): Promise<boolean> {
  try {
    // 小計点領域に関連付けられたグループ項目を取得
    const subtotalDefinitions = await getSubtotalDefinitionsByLayoutRegionId(subtotalRegionId)
    
    if (!subtotalDefinitions || subtotalDefinitions.length === 0) {
      return false
    }

    // グループ別に項目をまとめる
    const groupMap = new Map<string, string[]>()
    
    for (const definition of subtotalDefinitions) {
      const groupId = definition.questionGroupItem?.questionGroupId
      if (!groupId) continue
      
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(definition.questionGroupItemId)
    }

    if (groupMap.size === 0) {
      return false
    }

    // 各グループで該当する設問を取得（GROUP内OR）
    const groupQuestionSets: Set<string>[] = []
    
    for (const [groupId, itemIds] of groupMap) {
      const groupQuestionIds = new Set<string>()
      
      // 各項目に関連付けられた設問を取得
      for (const itemId of itemIds) {
        try {
          const assignments = await getAssignmentsByQuestionGroupItemId(itemId)
          if (assignments && assignments.length > 0) {
            assignments.forEach((assignment: any) => {
              groupQuestionIds.add(assignment.questionLayoutRegionId)
            })
          }
        } catch (error) {
          console.error(`Error getting assignments for item ${itemId}:`, error)
        }
      }
      
      groupQuestionSets.push(groupQuestionIds)
    }

    // GROUP間AND：全てのグループに共通する設問を取得
    let finalQuestionIds: Set<string>
    if (groupQuestionSets.length === 1) {
      finalQuestionIds = groupQuestionSets[0]
    } else {
      finalQuestionIds = new Set()
      const firstGroup = groupQuestionSets[0]
      
      for (const qId of firstGroup) {
        const existsInAllGroups = groupQuestionSets.every(group => group.has(qId))
        if (existsInAllGroups) {
          finalQuestionIds.add(qId)
        }
      }
    }

    return finalQuestionIds.has(questionId)
  } catch (error) {
    console.error(`Error checking if question ${questionId} is in subtotal ${subtotalRegionId}:`, error)
    return false
  }
}

/**
 * 小計点を計算する関数（GROUP内OR、GROUP間AND）
 */
export async function calculateSubtotalScore(
  subtotalRegionId: string,
  studentScores: ScoreDetail[]
): Promise<SubtotalResult> {
  try {
    // 小計点領域に関連付けられたグループ項目を取得
    const subtotalDefinitions = await getSubtotalDefinitionsByLayoutRegionId(subtotalRegionId)
    
    if (!subtotalDefinitions || subtotalDefinitions.length === 0) {
      return { score: 0, maxScore: 0 }
    }

    // グループ別に項目をまとめる
    const groupMap = new Map<string, string[]>()
    
    for (const definition of subtotalDefinitions) {
      const groupId = definition.questionGroupItem?.questionGroupId
      if (!groupId) continue
      
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(definition.questionGroupItemId)
    }

    if (groupMap.size === 0) {
      return { score: 0, maxScore: 0 }
    }

    // 各グループで該当する設問を取得（GROUP内OR）
    const groupQuestionSets: Set<string>[] = []
    
    for (const [groupId, itemIds] of groupMap) {
      const groupQuestionIds = new Set<string>()
      
      // 各項目に関連付けられた設問を取得
      for (const itemId of itemIds) {
        try {
          const assignments = await getAssignmentsByQuestionGroupItemId(itemId)
          if (assignments && assignments.length > 0) {
            assignments.forEach((assignment: any) => {
              groupQuestionIds.add(assignment.questionLayoutRegionId)
            })
          }
        } catch (error) {
          console.error(`Error getting assignments for item ${itemId}:`, error)
        }
      }
      
      groupQuestionSets.push(groupQuestionIds)
    }

    // GROUP間AND：全てのグループに共通する設問を取得
    let finalQuestionIds: Set<string>
    if (groupQuestionSets.length === 1) {
      finalQuestionIds = groupQuestionSets[0]
    } else {
      finalQuestionIds = new Set()
      const firstGroup = groupQuestionSets[0]
      
      for (const questionId of firstGroup) {
        const existsInAllGroups = groupQuestionSets.every(group => group.has(questionId))
        if (existsInAllGroups) {
          finalQuestionIds.add(questionId)
        }
      }
    }

    // 該当する設問の点数を合計
    let totalScore = 0
    let totalMaxScore = 0
    
    for (const questionId of finalQuestionIds) {
      const scoreDetail = studentScores.find(s => s.questionId === questionId)
      if (scoreDetail) {
        totalScore += scoreDetail.score || 0
        totalMaxScore += scoreDetail.maxScore
      }
    }

    return { score: totalScore, maxScore: totalMaxScore }
  } catch (error) {
    console.error(`Error calculating subtotal score for region ${subtotalRegionId}:`, error)
    return { score: 0, maxScore: 0 }
  }
}

/**
 * 小計点の対象設問インデックスを事前に構築する関数
 * パフォーマンス向上のため、複数の小計点について一括で処理
 */
export async function buildSubtotalTargetMap(
  subtotalRegions: any[],
  questionRegions: any[]
): Promise<SubtotalTargetMap> {
  const subtotalTargetMap: SubtotalTargetMap = {}
  
  for (const subtotalRegion of subtotalRegions) {
    const targetIndices: number[] = []
    
    for (let i = 0; i < questionRegions.length; i++) {
      const questionRegion = questionRegions[i]
      const isTarget = await checkIfQuestionIsInSubtotal(questionRegion.id, subtotalRegion.id)
      if (isTarget) {
        targetIndices.push(i)
      }
    }
    
    subtotalTargetMap[subtotalRegion.id] = targetIndices
    console.log(`Subtotal ${subtotalRegion.id} targets questions at indices: ${targetIndices.join(', ')}`)
  }

  return subtotalTargetMap
}

/**
 * 小計点の対象設問インデックスを取得する関数
 */
export async function getTargetQuestionIndicesForSubtotal(
  subtotalRegionId: string,
  scores: ScoreDetail[]
): Promise<number[]> {
  const targetIndices: number[] = []
  
  for (let i = 0; i < scores.length; i++) {
    const score = scores[i]
    const isTarget = await checkIfQuestionIsInSubtotal(score.questionId, subtotalRegionId)
    if (isTarget) {
      targetIndices.push(i)
    }
  }
  
  return targetIndices
}