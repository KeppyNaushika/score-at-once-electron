/**
 * ワークフロー関連の型定義
 * 
 * プロジェクト詳細ページの新しいフェーズベースUI用の型定義
 */

export interface WorkflowStep {
  id: string
  title: string
  description: string
  path: string
  icon: string
  isCompleted: boolean
  canStart: boolean
  dependsOn?: string[]
}

export interface WorkflowPhase {
  id: 1 | 2 | 3
  title: string
  description: string
  emoji: string
  steps: WorkflowStep[]
  isActive: boolean
  isCompleted: boolean
  canStart: boolean
  completedSteps: number
  totalSteps: number
  nextStepId?: string
}

export interface ProjectWorkflowData {
  phases: WorkflowPhase[]
  currentPhase: 1 | 2 | 3
  overallProgress: number
  nextAction: {
    title: string
    description: string
    path: string
    buttonText: string
  } | null
}

export interface WorkflowStats {
  masterImageCount: number
  cropRegionCount: number
  questionRegionCount: number
  studentCount: number
  answerSheetCount: number
}