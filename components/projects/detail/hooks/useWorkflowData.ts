import type { ProjectWorkflowData, WorkflowPhase, WorkflowStats, WorkflowStep } from "@/components/projects/detail/types"
import type { ProjectWithDetails } from "@/types/common.types"
import { getProjectProgress, getStepCompletionStatus } from "@/utils/projectStatus"
import { useMemo } from "react"

/**
 * ワークフローデータを生成するカスタムフック
 * 
 * 統計データとプロジェクト詳細から3フェーズのワークフロー情報を構築し、
 * 現在のフェーズと次のアクションを決定する（精密な判定ロジック使用）
 */
export function useWorkflowData(
  stats: WorkflowStats,
  project: ProjectWithDetails | null
): ProjectWorkflowData {
  const {
    masterImageCount,
    cropRegionCount,
    questionRegionCount,
    studentCount,
    answerSheetCount,
  } = stats

  return useMemo(() => {
    // プロジェクトデータがない場合はフォールバック
    const progress = project ? getProjectProgress(project) : null
    const _stepCompletions = project ? getStepCompletionStatus(project) : Array(8).fill(false)

    // Phase 1: 試験前準備
    const phase1Steps = [
      {
        id: "01-upload",
        title: "模範解答アップロード",
        description: "試験問題の模範解答画像をアップロード",
        path: "/01-upload",
        icon: "FileImage",
        isCompleted: progress?.hasImages ?? (masterImageCount > 0),
        canStart: true,
      },
      {
        id: "02-template",
        title: "採点領域作成",
        description: "各設問の採点範囲を視覚的に設定",
        path: "/02-template",
        icon: "Settings",
        isCompleted: progress?.hasLayout ?? (cropRegionCount > 0),
        canStart: progress?.hasImages ?? (masterImageCount > 0),
        dependsOn: ["01-upload"],
      },
      {
        id: "03-region-info",
        title: "領域情報",
        description: "各領域の種類、配点、ラベルを設定",
        path: "/03-region-info",
        icon: "Edit",
        isCompleted: progress?.hasRegionInfo ?? (questionRegionCount > 0),
        canStart: progress?.hasLayout ?? (cropRegionCount > 0),
        dependsOn: ["02-template"],
      },
      {
        id: "04-question-group",
        title: "小計点の設定",
        description: "設問グループと小計点の関連付けを設定",
        path: "/04-question-group",
        icon: "Calculator",
        isCompleted: progress?.hasSubtotalGroupSetting ?? (questionRegionCount > 0),
        canStart: progress?.hasRegionInfo ?? (questionRegionCount > 0),
        dependsOn: ["03-region-info"],
      },
      {
        id: "05-students",
        title: "受験生徒管理",
        description: "プロジェクトに参加する生徒を管理",
        path: "/05-students",
        icon: "Users",
        isCompleted: progress?.hasStudents ?? (studentCount > 0),
        canStart: progress?.hasSubtotalGroupSetting ?? (questionRegionCount > 0),
        dependsOn: ["04-question-group"],
      },
    ]

    // Phase 2: 試験後操作
    const phase2Steps = [
      {
        id: "06-student-answers",
        title: "答案アップロード",
        description: "スキャンした生徒の答案画像をアップロード",
        path: "/06-student-answers",
        icon: "Upload",
        isCompleted: progress?.hasAnswers ?? (answerSheetCount > 0),
        canStart: progress?.hasStudents ?? (studentCount > 0),
        dependsOn: ["05-students"],
      },
      {
        id: "07-score-at-once",
        title: "採点実行",
        description: "キーボードファーストで効率的に採点",
        path: "/07-score-at-once",
        icon: "BarChart3",
        isCompleted: progress?.hasScoring ?? false,
        canStart: (progress?.hasAnswers && progress?.hasRegionInfo) ?? 
                  (answerSheetCount > 0 && questionRegionCount > 0),
        dependsOn: ["06-student-answers"],
      },
    ]

    // Phase 3: 出力
    const phase3Steps = [
      {
        id: "08-export",
        title: "結果出力",
        description: "採点結果をExcel・PDFで出力",
        path: "/08-export",
        icon: "FileOutput",
        isCompleted: false, // 出力は何度でも実行可能
        canStart: progress?.hasScoring ?? false,
        dependsOn: ["07-score-at-once"],
      },
    ]

    // フェーズの完了状況を計算
    const phase1CompletedSteps = phase1Steps.filter(step => step.isCompleted).length
    const phase1IsCompleted = phase1CompletedSteps === phase1Steps.length

    const phase2CompletedSteps = phase2Steps.filter(step => step.isCompleted).length
    const phase2IsCompleted = phase2CompletedSteps === phase2Steps.length

    const phase3CompletedSteps = phase3Steps.filter(step => step.isCompleted).length
    // Phase 3（出力）は完了判定から除外
    const phase3IsCompleted = false

    // 現在のフェーズを決定
    let currentPhase: 1 | 2 | 3 = 1
    if (phase1IsCompleted && !phase2IsCompleted) {
      currentPhase = 2
    } else if (phase1IsCompleted && phase2IsCompleted) {
      currentPhase = 3
    }

    // フェーズデータを構築
    const phases: WorkflowPhase[] = [
      {
        id: 1,
        title: "試験前準備",
        description: "試験実施前の設定と準備作業",
        emoji: "🛠️",
        steps: phase1Steps,
        isActive: currentPhase === 1,
        isCompleted: phase1IsCompleted,
        canStart: true,
        completedSteps: phase1CompletedSteps,
        totalSteps: phase1Steps.length,
        nextStepId: phase1Steps.find(step => !step.isCompleted && step.canStart)?.id,
      },
      {
        id: 2,
        title: "試験後操作",
        description: "答案収集と採点作業",
        emoji: "📝",
        steps: phase2Steps,
        isActive: currentPhase === 2,
        isCompleted: phase2IsCompleted,
        canStart: phase1IsCompleted,
        completedSteps: phase2CompletedSteps,
        totalSteps: phase2Steps.length,
        nextStepId: phase2Steps.find(step => !step.isCompleted && step.canStart)?.id,
      },
      {
        id: 3,
        title: "出力",
        description: "採点結果の出力（常時利用可能）",
        emoji: "📤",
        steps: phase3Steps,
        isActive: currentPhase === 3,
        isCompleted: phase3IsCompleted,
        canStart: phase1IsCompleted && phase2IsCompleted,
        completedSteps: phase3CompletedSteps,
        totalSteps: phase3Steps.length,
        nextStepId: phase3Steps.find(step => !step.isCompleted && step.canStart)?.id,
      },
    ]

    // 全体進捗を計算（出力フェーズは除外）
    const totalSteps = phase1Steps.length + phase2Steps.length
    const totalCompletedSteps = phase1CompletedSteps + phase2CompletedSteps
    const overallProgress = (totalCompletedSteps / totalSteps) * 100

    // 次のアクションを決定
    const activePhase = phases.find(phase => phase.isActive)
    const nextAction = activePhase?.nextStepId
      ? (() => {
          const nextStep = activePhase.steps.find((step: WorkflowStep) => step.id === activePhase.nextStepId)
          return nextStep
            ? {
                title: nextStep.title,
                description: nextStep.description,
                path: nextStep.path,
                buttonText: `${nextStep.title}を開始`,
              }
            : null
        })()
      : null

    return {
      phases,
      currentPhase,
      overallProgress,
      nextAction,
    }
  }, [
    masterImageCount,
    cropRegionCount,
    questionRegionCount,
    studentCount,
    answerSheetCount,
    project,
  ])
}