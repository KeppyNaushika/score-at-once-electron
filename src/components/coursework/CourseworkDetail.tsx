"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BarChart3,
  ChevronRight,
  ClipboardEdit,
  Edit,
  FolderOutput,
  ListChecks,
  MoreVertical,
  Trash2,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  courseworkDetailQuery,
  deleteCourseworkMutation,
  exportCourseworkArchiveMutation,
} from "@/queries/coursework"

import { EditCourseworkWindow } from "./EditCourseworkWindow"

interface CourseworkDetailProps {
  courseworkId: string
}

interface WorkflowStep {
  id: string
  title: string
  description: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

/**
 * 試験外成績資料の概要ページ。
 * メタ情報の表示・基本設定の編集モーダル・各段階への導線を提供する。
 */
export function CourseworkDetail({ courseworkId }: CourseworkDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data: coursework, isPending: loading } = useQuery(
    courseworkDetailQuery(courseworkId)
  )
  const deleteCoursework = useMutation(deleteCourseworkMutation())
  const exportArchive = useMutation(exportCourseworkArchiveMutation())
  // 新規作成直後（?setup=1）は基本設定を促すため編集モーダルを開く
  const [showEditModal, setShowEditModal] = useState(
    () => searchParams.get("setup") === "1"
  )

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

  if (loading) {
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

  const classNames = coursework.classrooms
    .map((courseworkClassroom) => courseworkClassroom.classroom.name)
    .join("、")

  const steps: WorkflowStep[] = [
    {
      id: "02-students",
      title: "生徒管理",
      description: "学級から対象生徒を登録",
      path: `/coursework/${courseworkId}/02-students`,
      icon: Users,
    },
    {
      id: "03-items",
      title: "評価項目",
      description: "評価項目と配点を設定",
      path: `/coursework/${courseworkId}/03-items`,
      icon: ListChecks,
    },
    {
      id: "04-scores",
      title: "点数入力",
      description: "生徒ごとの点数を入力",
      path: `/coursework/${courseworkId}/04-scores`,
      icon: ClipboardEdit,
    },
    {
      id: "05-results",
      title: "結果",
      description: "集計結果の確認",
      path: `/coursework/${courseworkId}/05-results`,
      icon: BarChart3,
    },
  ]

  return (
    <div className="container mx-auto p-6">
      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{coursework.name}</h1>
          {coursework.description && (
            <p className="mt-2 text-muted-foreground">
              {coursework.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{classNames || "学級未登録"}</Badge>
            <Badge variant="outline">
              生徒: {coursework.students.length}名
            </Badge>
            <Badge variant="outline">評価項目: {coursework.items.length}</Badge>
            {coursework.date && (
              <Badge variant="secondary">
                実施日: {new Date(coursework.date).toLocaleDateString("ja-JP")}
              </Badge>
            )}
            {coursework.tags.map((courseworkTag) => (
              <Badge
                key={courseworkTag.tag.id}
                variant="secondary"
                style={
                  courseworkTag.tag.color
                    ? {
                        backgroundColor: courseworkTag.tag.color,
                        borderColor: courseworkTag.tag.color,
                      }
                    : undefined
                }
              >
                {courseworkTag.tag.name}
              </Badge>
            ))}
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
              <DropdownMenuItem onClick={handleExportArchive}>
                <FolderOutput className="mr-2 h-4 w-4" />
                .coursework 書き出し
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                資料を削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 各段階への導線 */}
      <Card>
        <CardContent className="space-y-2 p-4">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.path}
              className="block rounded-lg border p-3 transition-all hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h4 className="text-sm font-medium">{step.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {showEditModal && (
        <EditCourseworkWindow
          courseworkId={courseworkId}
          initialName={coursework.name}
          initialDescription={coursework.description ?? ""}
          initialDate={
            coursework.date
              ? new Date(coursework.date).toISOString().split("T")[0]
              : ""
          }
          initialTagIds={coursework.tags.map(
            (courseworkTag) => courseworkTag.tagId
          )}
          onClose={() => setShowEditModal(false)}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: courseworkDetailQuery(courseworkId).queryKey,
            })
          }
        />
      )}
    </div>
  )
}
