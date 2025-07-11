"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Settings, Calculator } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useQuestionGroupPage } from "@/components/projects/04-question-group/hooks/useQuestionGroupPage"
import { QuestionGroupManagement } from "@/components/projects/04-question-group/QuestionGroupManagement"
import { QuestionAssignmentMatrix } from "@/components/projects/04-question-group/QuestionAssignmentMatrix"
import { SubtotalPreview } from "@/components/projects/04-question-group/SubtotalPreview"

export default function QuestionGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const {
    project,
    questionGroups,
    layoutRegions,
    loading,
    error,
    selectedQuestionGroupId,
    setSelectedQuestionGroupId,
    refreshData,
    createQuestionGroup,
    updateQuestionGroup,
    deleteQuestionGroup,
    createQuestionGroupItem,
    updateQuestionGroupItem,
    deleteQuestionGroupItem,
    updateQuestionGroupItemOrders,
    updateQuestionAssignments,
    subtotalData,
  } = useQuestionGroupPage(projectId)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-6">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">
              エラーが発生しました
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">{error}</p>
            <Button onClick={refreshData} className="mt-4" variant="outline">
              再読み込み
            </Button>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <PageHeader
        title="小計点"
        description="設問をグループ化し、小計点を管理します。大問別や観点別の集計が可能です。"
        helpButton={helpButton}
      />

      <div className="grid grid-cols-1 gap-6">
        {/* 小計点 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              小計点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionGroupManagement
              questionGroups={questionGroups}
              selectedQuestionGroupId={selectedQuestionGroupId}
              setSelectedQuestionGroupId={setSelectedQuestionGroupId}
              onCreateQuestionGroup={createQuestionGroup}
              onUpdateQuestionGroup={updateQuestionGroup}
              onDeleteQuestionGroup={deleteQuestionGroup}
              onCreateQuestionGroupItem={createQuestionGroupItem}
              onUpdateQuestionGroupItem={updateQuestionGroupItem}
              onDeleteQuestionGroupItem={deleteQuestionGroupItem}
              onUpdateQuestionGroupItemOrders={updateQuestionGroupItemOrders}
            />
          </CardContent>
        </Card>

        {/* 設問とグループの関連付け */}
        {questionGroups.length > 0 && layoutRegions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                設問とグループの関連付け
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionAssignmentMatrix
                questionGroups={questionGroups}
                layoutRegions={layoutRegions}
                onUpdateAssignments={updateQuestionAssignments}
              />
            </CardContent>
          </Card>
        )}

        {/* 小計点プレビュー */}
        {subtotalData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                小計点プレビュー
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SubtotalPreview
                subtotalData={subtotalData}
                questionGroups={questionGroups}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* フッター */}
      <div className="flex justify-center">
        <Button
          onClick={() => router.push(`/projects/${projectId}/05-students`)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          次のステップ: 受験生徒管理
        </Button>
      </div>
    </div>
  )
}
