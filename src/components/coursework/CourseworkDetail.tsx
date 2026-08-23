"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FolderOutput, MoreVertical, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
import { getCourseworkCompletion } from "@/lib/courseworkStatus"
import {
  courseworkWorkflowPhases,
  courseworkWorkflowTabs,
} from "@/lib/workflowTabs"
import {
  courseworkDetailQuery,
  deleteCourseworkMutation,
  exportCourseworkArchiveMutation,
  setCourseworkTagsMutation,
  updateCourseworkMutation,
} from "@/queries/coursework"

interface CourseworkDetailProps {
  courseworkId: string
}

/**
 * 試験外成績資料の概要ページ。
 * 名前・実施日・説明・タグをその場で書き換え、段の進み具合をカードで見せる。
 */
export function CourseworkDetail({ courseworkId }: CourseworkDetailProps) {
  const router = useRouter()
  const { data: coursework = null, isPending: isLoading } = useQuery(
    courseworkDetailQuery(courseworkId)
  )
  const updateCoursework = useMutation(updateCourseworkMutation(courseworkId))
  const setCourseworkTags = useMutation(setCourseworkTagsMutation(courseworkId))
  const deleteCoursework = useMutation(deleteCourseworkMutation())
  const exportArchive = useMutation(exportCourseworkArchiveMutation())

  const handleCommitBasics = async (basics: EntityOverviewBasics) => {
    await updateCoursework.mutateAsync({
      name: basics.name,
      description: basics.description.trim() || null,
      referenceDate: basics.referenceDate || null,
    })
  }

  const handleReplaceTags = async (tagIds: string[]) => {
    await setCourseworkTags.mutateAsync(tagIds)
  }

  const handleDelete = async () => {
    const result = await deleteCoursework.mutateAsync(courseworkId)
    if (result.deleted) {
      router.push("/coursework")
      return
    }
    toast.error("削除できません", {
      description: `成績算出から参照されています: ${result.usedBy.join("、")}`,
    })
  }

  const handleExportArchive = () => {
    exportArchive.mutate(courseworkId, {
      onSuccess: (result) => {
        if (!result.canceled) {
          toast.success(`書き出しました: ${result.outputPath}`)
        }
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!coursework) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">資料が見つかりません</p>
      </div>
    )
  }

  const completion = getCourseworkCompletion(coursework)

  const stats: EntityOverviewStat[] = [
    { label: "学級", value: coursework.classrooms.length, tone: "blue" },
    { label: "生徒", value: coursework.students.length, tone: "indigo" },
    { label: "評価項目", value: coursework.items.length, tone: "purple" },
  ]

  return (
    <EntityOverviewPage
      nameLabel="資料名"
      dateLabel="実施日"
      dateHint="学級から生徒を追加するとき、この日に在籍していた生徒が対象になります。"
      basics={{
        name: coursework.name,
        referenceDate: toDateInputValue(coursework.referenceDate),
        description: coursework.description ?? "",
      }}
      onCommitBasics={handleCommitBasics}
      tags={coursework.tags.map((courseworkTag) => courseworkTag.tag)}
      onReplaceTags={handleReplaceTags}
      stats={stats}
      tabs={courseworkWorkflowTabs}
      entityHref={`/coursework/${courseworkId}`}
      phases={courseworkWorkflowPhases}
      stepCompletion={{
        "02-students": completion.hasStudents,
        "03-items": completion.hasItems,
        // 点数は概要の取得に含まれていないので入力済みかを判定できない。
        // 結果の確認は何度でもできるので済みという状態を持たない
        "04-scores": null,
        "05-results": null,
      }}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="その他の操作">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportArchive}>
              <FolderOutput className="mr-2 h-4 w-4" />
              .coursework 書き出し
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void handleDelete()}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              資料を削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  )
}
