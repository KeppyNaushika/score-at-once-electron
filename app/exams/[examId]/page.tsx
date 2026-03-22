"use client"

import type { Exam } from "@prisma/client"
import Head from "next/head"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ExamHeader from "@/components/exams/detail/ExamHeader"
import ExportModeModal from "@/components/exams/detail/ExportModeModal"
import { useWorkflowData } from "@/components/exams/detail/hooks/useWorkflowData"
import OverallProgress from "@/components/exams/detail/OverallProgress"
import PhaseCard from "@/components/exams/detail/PhaseCard"
import QuickStats from "@/components/exams/detail/QuickStats"
import EditExamWindow from "@/components/exams/forms/EditExamWindow"
import DeleteExamModal from "@/components/exams/shared/DeleteExamModal"
import { useAuth } from "@/contexts/AuthContext"
import { useExamDetail } from "@/hooks/useExamDetail"
import type { ExportMode } from "@/types/examArchive.types"

export default function ExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const {
    exam,
    isLoading,
    studentCount,
    questionRegionCount,
    modelAnswerCount,
    answerSheetCount,
    cropRegionCount,
    updateExam,
  } = useExamDetail(examId)

  // ワークフローデータを生成
  const workflowData = useWorkflowData(
    {
      masterImageCount: modelAnswerCount,
      cropRegionCount,
      questionRegionCount,
      studentCount,
      answerSheetCount,
    },
    exam
  )

  const handleExamUpdated = async (
    updatedExamData: Partial<
      Pick<Exam, "examName" | "description" | "examDate" | "subject">
    >
  ) => {
    const success = await updateExam(updatedExamData)
    if (success) {
      setShowEditModal(false)
    }
  }

  const handleExamDeleted = () => {
    router.push("/exams")
  }

  const handleExport = async (exportMode: ExportMode) => {
    if (isExporting) return

    if (!user?.id) {
      toast.error("エクスポート失敗", {
        description: "ログインが必要です。",
      })
      return
    }

    setIsExporting(true)
    toast("エクスポート中...", {
      description: "試験をエクスポートしています。",
    })

    try {
      const result = await window.electronAPI.archive.exportExam({
        examId,
        userId: user.id,
        exportMode,
      })

      if (result.success) {
        setShowExportModal(false)
        toast.success("エクスポート完了", {
          description: `${result.outputPath} に保存しました。`,
        })
      } else {
        if (result.error !== "キャンセルされました") {
          toast.error("エクスポート失敗", {
            description: result.error || "エクスポートに失敗しました。",
          })
        }
      }
    } catch (error) {
      toast.error("エクスポート失敗", {
        description:
          error instanceof Error ? error.message : "エラーが発生しました。",
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground mt-4">読み込み中...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!exam) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">試験が見つかりません</h1>
            <button
              onClick={() => router.push("/")}
              className="rounded bg-blue-500 px-4 py-2 text-white"
            >
              試験一覧に戻る
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>{exam?.examName || "試験"} - 一括採点</title>
      </Head>
      <div className="h-full overflow-auto">
        <div className="container mx-auto p-6">
          <ExamHeader
            exam={exam}
            onEdit={() => setShowEditModal(true)}
            onDelete={() => setShowDeleteModal(true)}
            onExport={() => setShowExportModal(true)}
          />

          <OverallProgress
            phases={workflowData.phases}
            currentPhase={workflowData.currentPhase}
            overallProgress={workflowData.overallProgress}
          />

          <QuickStats
            stats={{
              masterImageCount: modelAnswerCount,
              cropRegionCount,
              questionRegionCount,
              studentCount,
              answerSheetCount,
            }}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {workflowData.phases.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} examId={examId} />
            ))}
          </div>

          {/* Modals */}
          <ExportModeModal
            open={showExportModal}
            onOpenChange={setShowExportModal}
            onExport={handleExport}
            isExporting={isExporting}
          />
          {exam && showEditModal && (
            <EditExamWindow
              examToEdit={exam}
              setIsShowEditExamWindow={setShowEditModal}
              onSave={handleExamUpdated}
            />
          )}
          {exam && (
            <DeleteExamModal
              exam={exam}
              open={showDeleteModal}
              onOpenChange={setShowDeleteModal}
              onExamDeleted={handleExamDeleted}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
