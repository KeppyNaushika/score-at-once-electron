"use client"

import { useMutation } from "@tanstack/react-query"
import { FolderOutput, MoreVertical, Trash2, Users } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import type {
  EntityOverviewBasics,
  EntityOverviewStat,
} from "@/components/common/EntityOverviewPage"
import {
  EntityOverviewPage,
  toDateInputValue,
} from "@/components/common/EntityOverviewPage"
import type { ExportOutcome } from "@/components/common/ExportResultSummary"
import ExamArchiveExportModal from "@/components/exams/detail/ExamArchiveExportModal"
import DeleteExamModal from "@/components/exams/shared/DeleteExamModal"
import { MemberInviteDialog } from "@/components/exams/shared/MemberInviteDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useExamDetail } from "@/hooks/useExamDetail"
import { getExamProgress } from "@/lib/examStatus"
import { examWorkflowPhases, examWorkflowTabs } from "@/lib/workflowTabs"
import { exportExamArchiveMutation } from "@/queries/archive"
import { setExamTagsMutation } from "@/queries/tag"
import type { ArchiveExportMode } from "@/types/examArchive.types"

export default function ExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const currentUser = useCurrentUser()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showMemberDialog, setShowMemberDialog] = useState(false)
  /** 書き出しの結果。渡している間はモーダルが結果の段を見せる */
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
  const exportExamArchive = useMutation(exportExamArchiveMutation())
  const setExamTags = useMutation(setExamTagsMutation(examId))

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

  const handleCommitBasics = async (basics: EntityOverviewBasics) => {
    await updateExam({
      examName: basics.name,
      description: basics.description.trim() || null,
      referenceDate: basics.referenceDate
        ? new Date(basics.referenceDate)
        : null,
    })
  }

  const handleReplaceTags = async (tagIds: string[]) => {
    await setExamTags.mutateAsync(tagIds)
  }

  const handleExamDeleted = () => {
    router.push("/exams")
  }

  const handleExport = (exportMode: ArchiveExportMode) => {
    if (exportExamArchive.isPending) return

    toast("エクスポート中...", {
      description: "試験をエクスポートしています。",
    })

    exportExamArchive.mutate(
      { examId, userId: currentUser.id, exportMode },
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

  const progress = getExamProgress(exam)

  const stats: EntityOverviewStat[] = [
    { label: "模範解答", value: modelAnswerCount },
    { label: "採点領域", value: cropRegionCount },
    { label: "設問", value: questionRegionCount },
    { label: "受験生徒", value: studentCount },
    { label: "答案", value: answerSheetCount },
  ]

  return (
    <>
      <EntityOverviewPage
        nameLabel="試験名"
        dateLabel="試験日"
        dateHint="学級から生徒を追加するとき、この日に在籍していた生徒が対象になります。"
        basics={{
          name: exam.examName,
          referenceDate: toDateInputValue(exam.referenceDate),
          description: exam.description ?? "",
        }}
        onCommitBasics={handleCommitBasics}
        tags={exam.examTags.map((examTag) => examTag.tag)}
        onReplaceTags={handleReplaceTags}
        stats={stats}
        tabs={examWorkflowTabs}
        entityHref={`/exams/${examId}`}
        phases={examWorkflowPhases}
        stepCompletion={{
          "01-upload": progress.hasImages,
          "02-template": progress.hasLayout,
          "03-region-info": progress.hasRegionInfo,
          "04-question-group": progress.hasSubtotalGroupSetting,
          "05-students": progress.hasStudents,
          "06-student-answers": progress.hasAnswers,
          "07-score-at-once": progress.hasScoring,
          // 8. 採点確定は「要るかどうか」が採点者の食い違いで決まり、進捗の元データに
          // その材料が無い。9. 結果は何度でも出せるので済みという状態を持たない
          "08-finalize": null,
          "09-export": null,
        }}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMemberDialog(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              メンバー
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="その他の操作">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                  <FolderOutput className="mr-2 h-4 w-4" />
                  .score 書き出し
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteModal(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  試験を削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <ExamArchiveExportModal
        open={showExportModal}
        onOpenChange={handleExportModalOpenChange}
        onExport={handleExport}
        isExporting={exportExamArchive.isPending}
        exportOutcome={exportOutcome}
      />
      <MemberInviteDialog
        isOpen={showMemberDialog}
        onClose={() => setShowMemberDialog(false)}
        examId={examId}
        currentUserId={currentUser.id}
        examName={exam.examName}
      />
      <DeleteExamModal
        exam={exam}
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onExamDeleted={handleExamDeleted}
      />
    </>
  )
}
