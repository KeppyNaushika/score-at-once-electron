"use client"

import type { Exam } from "@prisma/client"
import { useMutation } from "@tanstack/react-query"
import Head from "next/head"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import type { ExportOutcome } from "@/components/common/ExportResultSummary"
import ExamArchiveExportModal from "@/components/exams/detail/ExamArchiveExportModal"
import ExamHeader from "@/components/exams/detail/ExamHeader"
import { useWorkflowData } from "@/components/exams/detail/hooks/useWorkflowData"
import OverallProgress from "@/components/exams/detail/OverallProgress"
import PhaseCard from "@/components/exams/detail/PhaseCard"
import QuickStats from "@/components/exams/detail/QuickStats"
import EditExamWindow from "@/components/exams/forms/EditExamWindow"
import DeleteExamModal from "@/components/exams/shared/DeleteExamModal"
import { useAuth } from "@/contexts/AuthContext"
import { useExamDetail } from "@/hooks/useExamDetail"
import { exportExamArchiveMutation } from "@/queries/archive"
import type { ArchiveExportMode } from "@/types/examArchive.types"

export default function ExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  /** 書き出しの結果。渡している間はモーダルが結果の段を見せる */
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
  const exportExamArchive = useMutation(exportExamArchiveMutation())

  const {
    exam,
    isLoading,
    studentCount,
    questionRegionCount,
    modelAnswerCount,
    answerSheetCount,
    cropRegionCount,
    gradeDataSourceCount,
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
      Pick<Exam, "examName" | "description" | "examDate">
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

  const handleExport = (exportMode: ArchiveExportMode) => {
    if (exportExamArchive.isPending) return

    if (!user?.id) {
      toast.error("エクスポート失敗", {
        description: "ログインが必要です。",
      })
      return
    }

    toast("エクスポート中...", {
      description: "試験をエクスポートしています。",
    })

    exportExamArchive.mutate(
      { examId, userId: user.id, exportMode },
      {
        onSuccess: (exportResult) => {
          // 保存先を選ばずに閉じたのは失敗ではないので、何も言わない
          if (exportResult.canceled) return
          // 結果はモーダルの中で見せる（欠けたファイル名まで出す）。
          // 書き出し中に閉じられていても、結果は見せる
          setShowExportModal(true)
          setExportOutcome({
            archives: [
              {
                sourceId: examId,
                sourceName: exam?.examName ?? "",
                outputPath: exportResult.outputPath,
                missingFiles: exportResult.missingFiles ?? [],
              },
            ],
            failures: [],
          })
        },
      }
    )
  }

  /** 閉じたら結果を捨てる（次に開いたときは選択の段から始まる） */
  const handleExportModalOpenChange = (open: boolean) => {
    setShowExportModal(open)
    if (!open) {
      setExportOutcome(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
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
    )
  }

  return (
    <>
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
          <ExamArchiveExportModal
            open={showExportModal}
            onOpenChange={handleExportModalOpenChange}
            onExport={handleExport}
            isExporting={exportExamArchive.isPending}
            exportOutcome={exportOutcome}
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
              masterImageCount={modelAnswerCount}
              answerSheetCount={answerSheetCount}
              cropRegionCount={cropRegionCount}
              gradeDataSourceCount={gradeDataSourceCount}
              open={showDeleteModal}
              onOpenChange={setShowDeleteModal}
              onExamDeleted={handleExamDeleted}
            />
          )}
        </div>
      </div>
    </>
  )
}
