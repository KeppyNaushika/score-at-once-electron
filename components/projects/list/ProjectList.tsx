"use client"

import {
  Edit,
  Eye,
  FileImage,
  PlayCircle,
  PlusCircle,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation" // useRouter をインポート

import { useFileActions } from "@/components/hooks/useFileActions"
import { useProjects } from "@/components/hooks/useProjects"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import CreateProjectWindow from "@/components/projects/forms/CreateProjectWindow"
import { ProjectWithDetails } from "@/types/common.types"

const File = () => {
  const { projects, loadProjects } = useProjects()

  const { createProjectModal } = useFileActions()
  const router = useRouter()

  const handleStartScoring = (project: ProjectWithDetails) => {
    router.push(`/projects/${project.id}`)
  }

  const getProjectStatus = (project: ProjectWithDetails) => {
    const hasImages = project.masterImages && project.masterImages.length > 0
    const hasLayout = project.layoutRegions && project.layoutRegions.length > 0
    const hasRegionInfo = hasLayout // 領域情報は領域が存在すれば設定済みとみなす
    const hasStudents =
      project.projectStudents && project.projectStudents.length > 0
    const hasAnswers = project.answerSheets && project.answerSheets.length > 0

    if (!hasImages)
      return {
        step: 1,
        action: "upload-master",
        text: "1. 模範解答をアップロード",
        url: `/projects/${project.id}/01-upload`,
      }
    if (!hasLayout)
      return {
        step: 2,
        action: "setup-regions",
        text: "2. 採点領域を設定",
        url: `/projects/${project.id}/02-template`,
      }
    if (!hasRegionInfo)
      return {
        step: 3,
        action: "edit-region-info",
        text: "3. 領域情報を編集",
        url: `/projects/${project.id}/03-region-info`,
      }
    if (!hasStudents)
      return {
        step: 4,
        action: "manage-students",
        text: "4. 受験生徒を確認",
        url: `/projects/${project.id}/04-students`,
      }
    if (!hasAnswers)
      return {
        step: 5,
        action: "upload-answers",
        text: "5. 生徒解答をアップロード",
        url: `/projects/${project.id}/05-answer-sheets`,
      }

    // 採点が完了しているかチェック
    // QUESTION_ANSWER領域数 × 答案数 = 全採点すべき数
    const questionAnswerCount =
      project.layoutRegions?.filter(
        (region) => region.type === "QUESTION_ANSWER",
      ).length || 0

    const answerSheetCount = project.answerSheets?.length || 0
    const expectedScoringCount = questionAnswerCount * answerSheetCount

    // ungraded以外のquestionScoresの個数を取得
    const actualScoringCount =
      project.answerSheets?.reduce((total, sheet) => {
        const gradedScores =
          sheet.questionScores?.filter((score) => score.status !== "unscored")
            .length || 0
        return total + gradedScores
      }, 0) || 0

    const hasScoring =
      expectedScoringCount > 0 && actualScoringCount >= expectedScoringCount

    if (!hasScoring) {
      return {
        step: 6,
        action: "start-grading",
        text: "6. 採点を開始",
        url: `/projects/${project.id}/06-score-at-once`,
      }
    }

    return {
      step: 7,
      action: "export-results",
      text: "7. 結果出力",
      url: `/projects/${project.id}/07-export`,
    }
  }

  const handleNextStep = (project: ProjectWithDetails) => {
    const status = getProjectStatus(project)
    router.push(status.url)
  }

  return (
    <>
      {createProjectModal.isOpen && (
        <CreateProjectWindow
          onClose={createProjectModal.close}
          onProjectCreated={loadProjects}
        />
      )}
      <div className="flex min-w-full flex-col">
        <div className="flex items-center space-x-2 border-b px-4 py-2">
          <Button onClick={createProjectModal.open} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            新規試験作成
          </Button>
        </div>

        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>プロジェクト名</TableHead>
                <TableHead className="w-32 text-center">詳細</TableHead>
                <TableHead className="w-40 text-center">次のステップ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const status = getProjectStatus(project as any)

                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.examName}</div>
                        <div className="text-muted-foreground text-sm">
                          {project.examDate
                            ? new Date(project.examDate).toLocaleDateString(
                                "ja-JP",
                              )
                            : "実施日未設定"}
                          {(project as any).tags &&
                            (project as any).tags.length > 0 && (
                              <span className="ml-2">
                                {(project as any).tags
                                  .map((tag: any) => tag.text)
                                  .join(", ")}
                              </span>
                            )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartScoring(project as any)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        詳細
                      </Button>
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => handleNextStep(project as any)}
                        className={
                          status.step === 6
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        }
                      >
                        {status.step === 1 && (
                          <FileImage className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 2 && (
                          <Settings className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 3 && <Edit className="mr-1 h-4 w-4" />}
                        {status.step === 4 && (
                          <Users className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 5 && (
                          <Upload className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 6 && (
                          <PlayCircle className="mr-1 h-4 w-4" />
                        )}
                        <span className="text-xs">{status.text}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}

export default File
