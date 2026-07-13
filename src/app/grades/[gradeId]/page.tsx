"use client"

import {
  BarChart3,
  ChevronRight,
  ClipboardEdit,
  Download,
  Edit,
  FolderOutput,
  MoreVertical,
  Settings,
  Sliders,
  Trash2,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { EditGradeWindow } from "@/components/grades/EditGradeWindow"
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
import { getGradeCompletion, type GradeStepCompletion } from "@/lib/gradeStatus"
import type { GradeWithRelations } from "@/types/grade.types"

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
  examId: string,
  completion: GradeStepCompletion
): WorkflowPhase[] {
  const phase1Steps: WorkflowStep[] = [
    {
      id: "02-students",
      title: "生徒管理",
      description: "学級から対象生徒を登録",
      path: `/grades/${examId}/02-students`,
      icon: Users,
      isCompleted: completion.hasStudents,
      canStart: completion.hasSetup,
    },
    {
      id: "03-data-sources",
      title: "データソース",
      description: "評価項目と成績データソースの設定",
      path: `/grades/${examId}/03-data-sources`,
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
      path: `/grades/${examId}/04-manual-scores`,
      icon: ClipboardEdit,
      isCompleted: completion.hasManualScores,
      canStart: completion.hasDataSources,
    },
    {
      id: "05-boundaries",
      title: "成績境界",
      description: "成績ラベルの境界値を設定",
      path: `/grades/${examId}/05-boundaries`,
      icon: Sliders,
      isCompleted: completion.hasBoundaries,
      canStart: completion.hasDataSources,
    },
  ]

  const phase3Steps: WorkflowStep[] = [
    {
      id: "06-results",
      title: "結果",
      description: "成績算出結果の確認",
      path: `/grades/${examId}/06-results`,
      icon: BarChart3,
      isCompleted: false,
      canStart: completion.hasDataSources && completion.hasBoundaries,
    },
    {
      id: "07-export",
      title: "出力",
      description: "Excel・個人成績通知書の出力",
      path: `/grades/${examId}/07-export`,
      icon: Download,
      isCompleted: false,
      canStart: completion.hasDataSources && completion.hasBoundaries,
    },
  ]

  const phase1CompletedCount = phase1Steps.filter(
    (step) => step.isCompleted
  ).length
  const phase1Completed = phase1CompletedCount === phase1Steps.length

  const phase2CompletedCount = phase2Steps.filter(
    (step) => step.isCompleted
  ).length
  const phase2Completed = phase2CompletedCount === phase2Steps.length

  let currentPhase: 1 | 2 | 3 = 1
  if (phase1Completed && !phase2Completed) {
    currentPhase = 2
  } else if (phase1Completed && phase2Completed) {
    currentPhase = 3
  }

  function findNextStep(steps: WorkflowStep[]) {
    const next = steps.find((step) => !step.isCompleted && step.canStart)
    return next ? { path: next.path, title: next.title } : null
  }

  const phase1Next = findNextStep(phase1Steps)
  const phase2Next = findNextStep(phase2Steps)
  const phase3Next = findNextStep(phase3Steps)

  return [
    {
      id: 1,
      title: "設定・準備",
      emoji: "🛠️",
      steps: phase1Steps,
      isActive: currentPhase === 1,
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
      isActive: currentPhase === 2,
      isCompleted: phase2Completed,
      completedSteps: phase2CompletedCount,
      totalSteps: phase2Steps.length,
      nextStepPath: phase2Next?.path ?? null,
      nextStepTitle: phase2Next?.title ?? null,
    },
    {
      id: 3,
      title: "出力",
      emoji: "📤",
      steps: phase3Steps,
      isActive: currentPhase === 3,
      isCompleted: false,
      completedSteps: 0,
      totalSteps: phase3Steps.length,
      nextStepPath: phase3Next?.path ?? null,
      nextStepTitle: phase3Next?.title ?? null,
    },
  ]
}

export default function GradeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  const [exam, setExam] = useState<GradeWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  // 新規作成直後（?setup=1）は基準日などの基本設定を促すため編集モーダルを開く
  const [showEditModal, setShowEditModal] = useState(
    () => searchParams.get("setup") === "1"
  )

  const loadExam = useCallback(async () => {
    try {
      const result = await window.electronAPI.grade.getById(gradeId)
      if (result.success && result.grade) {
        setExam(result.grade)
      }
    } catch (error) {
      console.error("Error loading grade exam:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  const handleDelete = async () => {
    const result = await window.electronAPI.grade.delete(gradeId)
    if (result.success) {
      router.push("/grades")
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">試験が見つかりません</p>
      </div>
    )
  }

  const completion = getGradeCompletion(exam)
  const phases = buildPhases(gradeId, completion)

  const completionSteps = [
    completion.hasStudents,
    completion.hasDataSources,
    completion.hasManualScores,
    completion.hasBoundaries,
  ]
  const overallProgress =
    (completionSteps.filter(Boolean).length / completionSteps.length) * 100

  const classNames = exam.gradeClassrooms
    .map((gradeClassroom) => gradeClassroom.classroom.name)
    .join("、")

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{exam.name}</h1>
              {exam.description && (
                <p className="text-muted-foreground mt-2">{exam.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4">
                <Badge variant="outline">{classNames || "学級未登録"}</Badge>
                <Badge variant="outline">
                  生徒: {exam._count?.gradeStudents ?? 0}名
                </Badge>
                <Badge variant="outline">
                  評価項目: {exam._count?.gradeItems ?? exam.gradeItems.length}
                </Badge>
                {exam.referenceDate && (
                  <Badge variant="secondary">
                    基準日:{" "}
                    {new Date(exam.referenceDate).toLocaleDateString("ja-JP")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
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
                      window.electronAPI.grade.exportArchive(gradeId)
                    }
                  >
                    <FolderOutput className="mr-2 h-4 w-4" />
                    .grade 書き出し
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    試験を削除
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
              <span>試験進捗</span>
              <span className="text-2xl font-bold text-blue-600">
                {Math.round(overallProgress)}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="mb-4 h-3" />
            <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

      {showEditModal && (
        <EditGradeWindow
          gradeId={gradeId}
          initialName={exam.name}
          initialDescription={exam.description ?? ""}
          initialReferenceDate={
            exam.referenceDate
              ? new Date(exam.referenceDate).toISOString().split("T")[0]
              : ""
          }
          onClose={() => setShowEditModal(false)}
          onSaved={loadExam}
        />
      )}
    </div>
  )
}
