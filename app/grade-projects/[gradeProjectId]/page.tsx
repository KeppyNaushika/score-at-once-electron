"use client"

import {
  BarChart3,
  ChevronRight,
  ClipboardEdit,
  Download,
  Edit,
  MoreVertical,
  Settings,
  Sliders,
  Trash2,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import type { GradeProjectWithDetails } from "@/types/gradeProject.types"
import {
  getGradeProjectCompletion,
  type GradeProjectStepCompletion,
} from "@/utils/gradeProjectStatus"

interface WorkflowStep {
  id: string
  title: string
  description: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  isCompleted: boolean
  canStart: boolean
}

interface WorkflowPhase {
  id: number
  title: string
  emoji: string
  steps: WorkflowStep[]
  isActive: boolean
  isCompleted: boolean
  completedSteps: number
  totalSteps: number
  nextStepPath: string | null
  nextStepTitle: string | null
}

function buildPhases(
  projectId: string,
  completion: GradeProjectStepCompletion
): WorkflowPhase[] {
  const phase1Steps: WorkflowStep[] = [
    {
      id: "01-setup",
      title: "基本設定",
      description: "プロジェクト名・基準日の設定",
      path: `/grade-projects/${projectId}/01-setup`,
      icon: Edit,
      isCompleted: completion.hasSetup,
      canStart: true,
    },
    {
      id: "02-students",
      title: "生徒管理",
      description: "学級から対象生徒を登録",
      path: `/grade-projects/${projectId}/02-students`,
      icon: Users,
      isCompleted: completion.hasStudents,
      canStart: completion.hasSetup,
    },
    {
      id: "03-data-sources",
      title: "データソース",
      description: "評価項目と成績データソースの設定",
      path: `/grade-projects/${projectId}/03-data-sources`,
      icon: Settings,
      isCompleted: completion.hasDataSources,
      canStart: completion.hasSetup,
    },
  ]

  const phase2Steps: WorkflowStep[] = [
    {
      id: "04-manual-scores",
      title: "外部成績",
      description: "手動入力スコアの登録",
      path: `/grade-projects/${projectId}/04-manual-scores`,
      icon: ClipboardEdit,
      isCompleted: completion.hasManualScores,
      canStart: completion.hasDataSources,
    },
    {
      id: "05-boundaries",
      title: "成績境界",
      description: "成績ラベルの境界値を設定",
      path: `/grade-projects/${projectId}/05-boundaries`,
      icon: Sliders,
      isCompleted: completion.hasBoundaries,
      canStart: completion.hasDataSources,
    },
    {
      id: "06-results",
      title: "結果",
      description: "成績算出結果の確認",
      path: `/grade-projects/${projectId}/06-results`,
      icon: BarChart3,
      isCompleted: false, // 結果は常にアクセス可能
      canStart: completion.hasDataSources && completion.hasBoundaries,
    },
    {
      id: "07-export",
      title: "出力",
      description: "Excel・個人成績通知書の出力",
      path: `/grade-projects/${projectId}/07-export`,
      icon: Download,
      isCompleted: false,
      canStart: completion.hasDataSources && completion.hasBoundaries,
    },
  ]

  const phase1Completed = phase1Steps
    .slice(0, -1)
    .every((step) => step.isCompleted) // setupとstudentsが完了
  const phase1CompletedCount = phase1Steps.filter(
    (step) => step.isCompleted
  ).length
  const phase2CompletedCount = phase2Steps.filter(
    (step) => step.isCompleted
  ).length

  // Phase 2 は結果・出力を除いた完了判定
  const phase2DoneSteps = phase2Steps.slice(0, -2)
  const phase2AllDone = phase2DoneSteps.every((step) => step.isCompleted)

  const phase1IsActive = !phase1Completed
  const phase2IsActive = phase1Completed && !phase2AllDone

  function findNextStep(steps: WorkflowStep[]) {
    const next = steps.find((step) => !step.isCompleted && step.canStart)
    return next ? { path: next.path, title: next.title } : null
  }

  const phase1Next = findNextStep(phase1Steps)
  const phase2Next = findNextStep(phase2Steps)

  return [
    {
      id: 1,
      title: "設定・準備",
      emoji: "🛠️",
      steps: phase1Steps,
      isActive: phase1IsActive,
      isCompleted: phase1Completed,
      completedSteps: phase1CompletedCount,
      totalSteps: phase1Steps.length,
      nextStepPath: phase1Next?.path ?? null,
      nextStepTitle: phase1Next?.title ?? null,
    },
    {
      id: 2,
      title: "成績算出",
      emoji: "📊",
      steps: phase2Steps,
      isActive: phase2IsActive,
      isCompleted: phase2AllDone,
      completedSteps: phase2CompletedCount,
      totalSteps: phase2Steps.length,
      nextStepPath: phase2Next?.path ?? null,
      nextStepTitle: phase2Next?.title ?? null,
    },
  ]
}

export default function GradeProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const gradeProjectId = params.gradeProjectId as string

  const [project, setProject] = useState<GradeProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProject = useCallback(async () => {
    try {
      const result =
        await window.electronAPI.gradeProject.getById(gradeProjectId)
      if (result.success && result.gradeProject) {
        setProject(result.gradeProject)
      }
    } catch (error) {
      console.error("Error loading grade project:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeProjectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const handleDelete = async () => {
    const result = await window.electronAPI.gradeProject.delete(gradeProjectId)
    if (result.success) {
      router.push("/grade-projects")
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">プロジェクトが見つかりません</p>
      </div>
    )
  }

  const completion = getGradeProjectCompletion(project)
  const phases = buildPhases(gradeProjectId, completion)

  const completionSteps = [
    completion.hasSetup,
    completion.hasStudents,
    completion.hasDataSources,
    completion.hasManualScores,
    completion.hasBoundaries,
  ]
  const overallProgress =
    (completionSteps.filter(Boolean).length / completionSteps.length) * 100

  const classNames = project.gradeProjectClasses
    .map((gradeProjectClass) => gradeProjectClass.class.name)
    .join("、")

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-2">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4">
                <Badge variant="outline">{classNames || "学級未登録"}</Badge>
                <Badge variant="outline">
                  生徒: {project._count?.gradeProjectStudents ?? 0}名
                </Badge>
                <Badge variant="outline">
                  評価項目:{" "}
                  {project._count?.gradeItems ?? project.gradeItems.length}
                </Badge>
                {project.referenceDate && (
                  <Badge variant="secondary">
                    基準日:{" "}
                    {new Date(project.referenceDate).toLocaleDateString(
                      "ja-JP"
                    )}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/grade-projects/${gradeProjectId}/01-setup`)
                }
              >
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      window.electronAPI.gradeProject.exportArchive(
                        gradeProjectId
                      )
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    エクスポート
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    プロジェクトを削除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* 進捗バー */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span>プロジェクト進捗</span>
              <span className="text-2xl font-bold text-blue-600">
                {Math.round(overallProgress)}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="mb-4 h-3" />
            <div className="grid grid-cols-2 gap-4">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  className={`rounded-lg p-3 text-center transition-all ${
                    phase.isActive
                      ? "border-2 border-blue-200 bg-blue-50"
                      : phase.isCompleted
                        ? "border-2 border-green-200 bg-green-50"
                        : "border-2 border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="mb-1 text-2xl">{phase.emoji}</div>
                  <h3 className="mb-1 text-sm font-medium">{phase.title}</h3>
                  <div className="text-xs text-gray-600">
                    {phase.completedSteps}/{phase.totalSteps} 完了
                  </div>
                  <div
                    className={`mt-1 text-xs font-medium ${
                      phase.isActive
                        ? "text-blue-600"
                        : phase.isCompleted
                          ? "text-green-600"
                          : "text-gray-500"
                    }`}
                  >
                    {phase.isCompleted
                      ? "✓ 完了"
                      : phase.isActive
                        ? "実行中"
                        : "待機中"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* フェーズカード */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {phases.map((phase) => (
            <Card
              key={phase.id}
              className={`h-full transition-all ${
                phase.isActive
                  ? "border-blue-300 shadow-lg"
                  : phase.isCompleted
                    ? "border-green-300"
                    : "border-gray-200"
              }`}
            >
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{phase.emoji}</span>
                    <h3 className="text-lg font-semibold">{phase.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {phase.completedSteps}/{phase.totalSteps}
                    </div>
                    <div className="text-xs text-gray-600">完了</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phase.steps.map((step) => {
                    const statusColor = step.isCompleted
                      ? "text-green-600"
                      : step.canStart
                        ? "text-blue-600"
                        : "text-gray-400"
                    const rowClass = step.isCompleted
                      ? "bg-green-50"
                      : step.canStart
                        ? "bg-blue-50"
                        : "bg-gray-50"

                    return (
                      <Link
                        key={step.id}
                        href={step.path}
                        className={`block cursor-pointer rounded-lg p-3 transition-all hover:shadow-sm ${rowClass}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-1 items-center gap-3">
                            <div className={statusColor}>
                              {step.isCompleted ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                                  <span className="text-xs text-white">✓</span>
                                </div>
                              ) : (
                                <step.icon className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4
                                className={`text-sm font-medium ${statusColor}`}
                              >
                                {step.title}
                              </h4>
                              <p className="mt-1 text-xs text-gray-600">
                                {step.description}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="ml-2 h-4 w-4 text-gray-400" />
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {phase.isActive && phase.nextStepPath && (
                  <div className="mt-4 border-t pt-4">
                    <Link href={phase.nextStepPath}>
                      <Button className="w-full" size="sm">
                        次へ: {phase.nextStepTitle}
                      </Button>
                    </Link>
                  </div>
                )}

                {phase.isCompleted && (
                  <div className="mt-4 border-t pt-4">
                    <div className="text-center text-sm font-medium text-green-600">
                      ✓ 完了
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
