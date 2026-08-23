"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FolderOutput, MoreVertical, Trash2 } from "lucide-react"
import { useParams, useRouter } from "next/navigation"

import type {
  EntityOverviewBasics,
  EntityOverviewStat,
} from "@/components/common/EntityOverviewPage"
import {
  EntityOverviewPage,
  toDateInputValue,
} from "@/components/common/EntityOverviewPage"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getGradeCompletion } from "@/lib/gradeStatus"
import { gradeWorkflowPhases, gradeWorkflowTabs } from "@/lib/workflowTabs"
import {
  deleteGradeMutation,
  exportGradeArchiveMutation,
  gradeDetailQuery,
  setGradeTagsMutation,
  updateGradeMutation,
} from "@/queries/grade"

export default function GradeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  const { data: grade = null, isPending: isLoading } = useQuery(
    gradeDetailQuery(gradeId)
  )
  const updateGrade = useMutation(updateGradeMutation(gradeId))
  const setGradeTags = useMutation(setGradeTagsMutation(gradeId))
  const deleteGrade = useMutation(deleteGradeMutation())
  const exportArchive = useMutation(exportGradeArchiveMutation())

  const handleCommitBasics = async (basics: EntityOverviewBasics) => {
    await updateGrade.mutateAsync({
      name: basics.name,
      description: basics.description.trim() || null,
      referenceDate: basics.referenceDate || null,
    })
  }

  const handleReplaceTags = async (tagIds: string[]) => {
    await setGradeTags.mutateAsync(tagIds)
  }

  const handleDelete = async () => {
    await deleteGrade.mutateAsync(gradeId)
    router.push("/grades")
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!grade) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">成績算出が見つかりません</p>
      </div>
    )
  }

  const completion = getGradeCompletion(grade)
  const dataSourceCount = grade.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  ).length

  const stats: EntityOverviewStat[] = [
    { label: "学級", value: grade.gradeClassrooms.length, tone: "blue" },
    { label: "生徒", value: grade.gradeStudents.length, tone: "indigo" },
    { label: "評価項目", value: grade.gradeItems.length, tone: "purple" },
    { label: "データソース", value: dataSourceCount, tone: "green" },
  ]

  return (
    <EntityOverviewPage
      nameLabel="成績算出名"
      dateLabel="成績算出日"
      dateHint="学級から生徒を追加するとき、この日に在籍していた生徒が対象になります。未設定なら本日が基準です。"
      basics={{
        name: grade.name,
        referenceDate: toDateInputValue(grade.referenceDate),
        description: grade.description ?? "",
      }}
      onCommitBasics={handleCommitBasics}
      tags={grade.gradeTags.map((gradeTag) => gradeTag.tag)}
      onReplaceTags={handleReplaceTags}
      stats={stats}
      tabs={gradeWorkflowTabs}
      entityHref={`/grades/${gradeId}`}
      phases={gradeWorkflowPhases}
      stepCompletion={{
        "02-students": completion.hasStudents,
        "03-data-sources": completion.hasDataSources,
        "04-manual-scores": completion.hasManualScores,
        "05-boundaries": completion.hasBoundaries,
        // 結果の確認と出力は何度でもできるので、済みという状態を持たない
        "06-results": null,
        "07-export": null,
      }}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="その他の操作">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportArchive.mutate(gradeId)}>
              <FolderOutput className="mr-2 h-4 w-4" />
              .grade 書き出し
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void handleDelete()}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              成績算出を削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  )
}
