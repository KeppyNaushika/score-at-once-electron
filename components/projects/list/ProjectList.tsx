"use client"

import {
  Calculator,
  Download,
  Edit,
  Eye,
  FileImage,
  PlayCircle,
  PlusCircle,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { useFileActions } from "@/components/hooks/useFileActions"
import { useProjects } from "@/components/hooks/useProjects"
import CreateProjectWindow from "@/components/projects/forms/CreateProjectWindow"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { QuestionScore, CropRegion } from "@prisma/client"
import { 
  ProjectWithDetails, 
  SerializedProject, 
  isValidProject, 
  isValidCropRegion,
  isValidQuestionScore 
} from "@/types/common.types"

// 実際のデータ構造に基づく型定義
type CropRegionWithQuestionScores = {
  id: string
  projectPageId: string
  label: string
  type: string
  x: number
  y: number
  width: number
  height: number
  points: number | null
  orderIndex: number | null
  createdAt: string
  updatedAt: string
  questionScores?: {
    id: string
    cropRegionId: string
    studentId: string | null
    partialScore: number | null
    status: string
    scoredByUserId: string | null
    createdAt: string
    updatedAt: string
    student: {
      id: string
      createdAt: string
      updatedAt: string
      studentId: string
      lastName: string
      firstName: string
      lastNameKana: string
      firstNameKana: string
      enrollmentYear: number | null
    } | null
    scoredByUser: {
      id: string
      createdAt: string
      updatedAt: string
      username: string
      passcode: string | null
      name: string
      role: string
      passcodeType: string | null
    } | null
  }[]
}

type QuestionScoreFromProject = NonNullable<CropRegionWithQuestionScores['questionScores']>[number]

const File = () => {
  const { projects, loadProjects } = useProjects()

  const { createProjectModal } = useFileActions()
  const router = useRouter()

  const handleStartScoring = (project: ProjectWithDetails) => {
    router.push(`/projects/${project.id}`)
  }

  const getProjectStatus = (project: ProjectWithDetails) => {
    // 型ガードを使用してデータの安全性を確認
    if (!isValidProject(project)) {
      console.warn('Invalid project data:', project)
      // 無効なprojectでも基本的なidプロパティは存在する可能性が高い
      const projectId = (project as { id?: string }).id || 'unknown'
      return {
        step: 1,
        action: "upload",
        text: "データエラー",
        url: `/projects/${projectId}/01-upload`,
      }
    }
    const hasImages = project.projectPages && project.projectPages.length > 0
    const hasLayout = project.cropRegions && project.cropRegions.length > 0
    const hasRegionInfo = hasLayout // 領域情報は領域が存在すれば設定済みとみなす

    // 小計点領域が存在するかチェック（型ガード使用）
    const hasSubtotalRegions =
      project.cropRegions?.some((region) => 
        isValidCropRegion(region) && region.type === "SUBTOTAL_SCORE"
      ) || false
    // 小計点設定が完了しているかチェック（小計点領域がある場合のみ）
    const hasSubtotalGroupSetting =
      !hasSubtotalRegions ||
      (project.projectSubtotalGroups &&
        project.projectSubtotalGroups.length > 0)

    const hasStudents =
      project.projectStudents && project.projectStudents.length > 0
    const hasAnswers = project.answerImages && project.answerImages.length > 0

    if (!hasImages)
      return {
        step: 1,
        action: "upload",
        text: "模範解答画像の管理",
        url: `/projects/${project.id}/01-upload`,
      }
    if (!hasLayout)
      return {
        step: 2,
        action: "template",
        text: "答案の採点領域作成",
        url: `/projects/${project.id}/02-template`,
      }
    if (!hasRegionInfo)
      return {
        step: 3,
        action: "region-info",
        text: "採点領域の詳細情報設定",
        url: `/projects/${project.id}/03-region-info`,
      }
    if (!hasSubtotalGroupSetting)
      return {
        step: 4,
        action: "question-group",
        text: "小計点の設定",
        url: `/projects/${project.id}/04-question-group`,
      }
    if (!hasStudents)
      return {
        step: 5,
        action: "students",
        text: "受験生徒の管理",
        url: `/projects/${project.id}/05-students`,
      }
    if (!hasAnswers)
      return {
        step: 6,
        action: "student-answers",
        text: "生徒答案の追加と関連付け",
        url: `/projects/${project.id}/06-student-answers`,
      }

    // 採点が完了しているかチェック
    // QUESTION_ANSWER領域数 × 答案数 = 全採点すべき数
    const questionAnswerCount =
      project.cropRegions?.filter((region) => 
        isValidCropRegion(region) && region.type === "QUESTION_ANSWER"
      ).length || 0

    const answerSheetCount = project.answerImages?.length || 0
    const expectedScoringCount = questionAnswerCount * answerSheetCount

    // unscored以外のquestionScoresの個数を取得（型ガード使用）
    const actualScoringCount =
      project.cropRegions?.reduce((total, region) => {
        if (isValidCropRegion(region) && region.type === "QUESTION_ANSWER" && 'questionScores' in region) {
          const regionWithScores = region as CropRegionWithQuestionScores
          const validQuestionScores = regionWithScores.questionScores?.filter(
            (score): score is QuestionScoreFromProject => 
              isValidQuestionScore(score) && score.status !== "unscored"
          ) || []
          return total + validQuestionScores.length
        }
        return total
      }, 0) || 0

    const hasScoring =
      expectedScoringCount > 0 && actualScoringCount >= expectedScoringCount

    if (!hasScoring) {
      return {
        step: 7,
        action: "score-at-once",
        text: "一括採点",
        url: `/projects/${project.id}/07-score-at-once`,
      }
    }

    return {
      step: 8,
      action: "export",
      text: "採点結果のファイル出力",
      url: `/projects/${project.id}/08-export`,
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
                // 型ガードを使用して安全にproject処理
                if (!isValidProject(project)) {
                  console.warn('Skipping invalid project:', project)
                  return null
                }
                
                const status = getProjectStatus(project)

                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.examName}</div>
                        <div className="text-muted-foreground text-sm">
                          {project.examDate
                            ? typeof project.examDate === 'string'
                              ? new Date(project.examDate).toLocaleDateString("ja-JP")
                              : new Date(project.examDate).toLocaleDateString("ja-JP")
                            : "実施日未設定"}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartScoring(project)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        詳細
                      </Button>
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => handleNextStep(project)}
                        className="w-48 justify-start text-left"
                      >
                        {status.step === 1 && (
                          <FileImage className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 2 && (
                          <Settings className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 3 && <Edit className="mr-1 h-4 w-4" />}
                        {status.step === 4 && (
                          <Calculator className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 5 && (
                          <Users className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 6 && (
                          <Upload className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 7 && (
                          <PlayCircle className="mr-1 h-4 w-4" />
                        )}
                        {status.step === 8 && (
                          <Download className="mr-1 h-4 w-4" />
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
